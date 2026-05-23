/**
 * Service Store — Worker data, live trades, alerts, logs, metrics, connection state.
 * Follows TUI Pattern 2: Store Subscription with selectors.
 *
 * Connection State Machine:
 *
 *   ┌──────────┐    fail     ┌──────────────┐   success    ┌───────────┐
 *   │ connected │ ──────────→ │ reconnecting │ ───────────→ │ connected │
 *   └──────────┘             └──────┬───────┘              └───────────┘
 *        ↑                          │
 *        │                  backoff exhausted
 *        │                          │
 *        │                          ▼
 *        │                   ┌──────────┐    manual     ┌───────────┐
 *        └─────────────────── │ offline  │ ────────────→ │ polling   │
 *              success        └──────────┘              └─────┬─────┘
 *                                                             │
 *                                                    fail     │
 *                                                      ┌──────┘
 *                                                      ▼
 *                                               ┌──────────┐
 *                                               │ offline  │
 *                                               └──────────┘
 *
 * Exponential backoff: 1s → 2s → 4s → 8s → 16s (max).
 * Tracks retryCount, lastError, and lastSuccessfulFetch for observability.
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  WorkerInfo,
  Trade,
  Alert,
  LogEntry,
  SystemMetrics,
  ConnectionStatus,
} from "../types";

// ─── Backoff Constants ───────────────────────────────────────────────────────

/** Backoff sequence: 1s, 2s, 4s, 8s, 16s */
const BACKOFF_SEQUENCE = [1000, 2000, 4000, 8000, 16000];
/** Maximum retry attempts before transitioning to offline */
const MAX_RETRIES = 5;

// ─── Ring Buffer Helper ──────────────────────────────────────────────────────

function ringPush<T>(arr: T[], item: T, max: number): T[] {
  const next = [...arr, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

// ─── State ───────────────────────────────────────────────────────────────────

export interface ServiceState {
  workers: WorkerInfo[];
  tradeStream: Trade[]; // ring buffer, newest last, max 500
  alerts: Alert[]; // max 100
  logs: LogEntry[]; // ring buffer, max 1000
  metrics: SystemMetrics | null;
  connectionStatus: ConnectionStatus;
  lastUpdated: number; // timestamp ms
  selectedWorkerId: string | null;

  // ── Connection state machine fields ──────────────────────────────────────
  /** Number of consecutive failed reconnection attempts */
  retryCount: number;
  /** Last connection error message (for display) */
  lastError: string | null;
  /** Timestamp (ms) of the last successful API fetch */
  lastSuccessfulFetch: number;
  /** Current backoff delay in ms (0 when not reconnecting) */
  reconnectDelay: number;
  /** Timestamp when the connection was lost (for downtime calculation) */
  disconnectedAt: number | null;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

interface ServiceActions {
  fetchWorkers: () => Promise<void>;
  streamTrades: () => Promise<void>;
  streamLogs: () => Promise<void>;
  addAlert: (alert: Alert) => void;
  addAlerts: (alerts: Alert[]) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  selectWorker: (id: string | null) => void;
  setWorkers: (workers: WorkerInfo[]) => void;
  pushTrade: (trade: Trade) => void;
  pushLog: (log: LogEntry) => void;
  setMetrics: (metrics: SystemMetrics) => void;

  // ── Connection state machine actions ─────────────────────────────────────
  /** Called on successful API response — resets error state */
  handleConnectionSuccess: () => void;
  /** Called on API failure — increments retry, applies backoff */
  handleConnectionFailure: (errorMessage: string) => void;
  /** Reset all retry/reconnect state (on full reconnect) */
  resetRetries: () => void;
  /** Force a connection retry from offline state */
  forceRetry: () => void;
}

// ─── Buffer Caps ─────────────────────────────────────────────────────────────

const MAX_TRADES = 500;
const MAX_ALERTS = 100;
const MAX_LOGS = 1000;

// ─── Defaults ────────────────────────────────────────────────────────────────

const initialState: ServiceState = {
  workers: [],
  tradeStream: [],
  alerts: [],
  logs: [],
  metrics: null,
  connectionStatus: "offline",
  lastUpdated: 0,
  selectedWorkerId: null,
  // Connection machine defaults
  retryCount: 0,
  lastError: null,
  lastSuccessfulFetch: 0,
  reconnectDelay: 0,
  disconnectedAt: null,
};

// ─── Backoff Helper ──────────────────────────────────────────────────────────

/**
 * Calculate the backoff delay for a given retry count.
 * Returns 0 if count is out of range.
 */
function getBackoffDelay(retryCount: number): number {
  if (retryCount <= 0) return 0;
  const index = Math.min(retryCount - 1, BACKOFF_SEQUENCE.length - 1);
  return BACKOFF_SEQUENCE[index];
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useServiceStore = create<ServiceState & ServiceActions>()(
  immer((set, get) => ({
    ...initialState,

    // ── Async: fetch workers from hoox-setup REST API ──────────────────────
    fetchWorkers: async () => {
      const { hooxFetch } = await import("../api-client");
      try {
        const data = await hooxFetch<WorkerInfo[]>("/workers");
        set((state) => {
          state.workers = data;
          state.lastUpdated = Date.now();
          state.lastSuccessfulFetch = Date.now();
          // Transition: polling/reconnecting/offline → connected on success
          if (
            state.connectionStatus === "polling" ||
            state.connectionStatus === "reconnecting" ||
            state.connectionStatus === "offline"
          ) {
            state.connectionStatus = "connected";
            state.retryCount = 0;
            state.lastError = null;
            state.reconnectDelay = 0;
            state.disconnectedAt = null;
          }
        });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown fetch error";
        set((state) => {
          // Transition: connected/polling → reconnecting on failure
          if (
            state.connectionStatus === "connected" ||
            state.connectionStatus === "polling"
          ) {
            state.connectionStatus = "reconnecting";
            state.retryCount = state.retryCount + 1;
            state.lastError = msg;
            state.disconnectedAt = state.disconnectedAt ?? Date.now();

            // Check if backoff exhausted — transition to offline
            if (state.retryCount >= MAX_RETRIES) {
              state.connectionStatus = "offline";
              state.lastError = `Connection lost after ${MAX_RETRIES} retries`;
            } else {
              state.reconnectDelay = getBackoffDelay(state.retryCount);
            }
          }
          // Already offline/reconnecting — just update error info
          if (state.connectionStatus === "reconnecting") {
            state.lastError = msg;
          }
        });
      }
    },

    // ── Async: stream trades via SSE ───────────────────────────────────────
    streamTrades: async () => {
      const { subscribeSSE } = await import("../sse");
      try {
        await subscribeSSE<Trade>("/trades/stream", (trade) => {
          get().pushTrade(trade);
        });
      } catch {
        // SSE connection failure — handled by connection state machine elsewhere
      }
    },

    // ── Async: stream logs via SSE ─────────────────────────────────────────
    streamLogs: async () => {
      const { subscribeSSE } = await import("../sse");
      try {
        await subscribeSSE<LogEntry>("/logs/stream", (log) => {
          get().pushLog(log);
        });
      } catch {
        // SSE connection failure — handled by connection state machine elsewhere
      }
    },

    // ── Sync: add single alert ─────────────────────────────────────────────
    addAlert: (alert) =>
      set((state) => {
        state.alerts = ringPush(state.alerts, alert, MAX_ALERTS);
      }),

    // ── Sync: bulk add alerts ──────────────────────────────────────────────
    addAlerts: (alerts) =>
      set((state) => {
        const merged = [...state.alerts, ...alerts];
        state.alerts =
          merged.length > MAX_ALERTS
            ? merged.slice(merged.length - MAX_ALERTS)
            : merged;
      }),

    // ── Sync: connection state machine transition ──────────────────────────
    // Valid transitions:
    //   connected    → reconnecting (on failure)
    //   reconnecting → connected (on success) | offline (backoff exhausted)
    //   offline      → polling (manual retry)
    //   polling      → connected (on success) | offline (on failure)
    setConnectionStatus: (status) =>
      set((state) => {
        // Reset retry count on manual transitions to connected
        if (status === "connected") {
          state.retryCount = 0;
          state.lastError = null;
          state.reconnectDelay = 0;
          state.disconnectedAt = null;
        }
        // Track disconnect time
        if (status === "offline" || status === "reconnecting") {
          state.disconnectedAt = state.disconnectedAt ?? Date.now();
        }
        state.connectionStatus = status;
      }),

    // ── Sync: select a worker for detail view ──────────────────────────────
    selectWorker: (id) =>
      set((state) => {
        state.selectedWorkerId = id;
      }),

    // ── Sync: replace worker list ──────────────────────────────────────────
    setWorkers: (workers) =>
      set((state) => {
        state.workers = workers;
        state.lastUpdated = Date.now();
      }),

    // ── Sync: push a single trade into the ring buffer ─────────────────────
    pushTrade: (trade) =>
      set((state) => {
        state.tradeStream = ringPush(state.tradeStream, trade, MAX_TRADES);
      }),

    // ── Sync: push a single log entry into the ring buffer ─────────────────
    pushLog: (log) =>
      set((state) => {
        state.logs = ringPush(state.logs, log, MAX_LOGS);
      }),

    // ── Sync: update aggregate system metrics ──────────────────────────────
    setMetrics: (metrics) =>
      set((state) => {
        state.metrics = metrics;
        state.lastUpdated = metrics.lastUpdated;
      }),

    // ── Connection State Machine: on success ───────────────────────────────
    handleConnectionSuccess: () =>
      set((state) => {
        state.lastSuccessfulFetch = Date.now();
        state.retryCount = 0;
        state.lastError = null;
        state.reconnectDelay = 0;
        state.disconnectedAt = null;
        if (
          state.connectionStatus === "reconnecting" ||
          state.connectionStatus === "polling"
        ) {
          state.connectionStatus = "connected";
        }
      }),

    // ── Connection State Machine: on failure ───────────────────────────────
    handleConnectionFailure: (errorMessage) =>
      set((state) => {
        state.lastError = errorMessage;
        state.disconnectedAt = state.disconnectedAt ?? Date.now();

        if (
          state.connectionStatus === "connected" ||
          state.connectionStatus === "polling"
        ) {
          state.connectionStatus = "reconnecting";
          state.retryCount = 1;
          state.reconnectDelay = getBackoffDelay(1);
        } else if (state.connectionStatus === "reconnecting") {
          state.retryCount = state.retryCount + 1;
          if (state.retryCount >= MAX_RETRIES) {
            state.connectionStatus = "offline";
            state.lastError = `Connection lost after ${MAX_RETRIES} retries`;
            state.reconnectDelay = 0;
          } else {
            state.reconnectDelay = getBackoffDelay(state.retryCount);
          }
        }
      }),

    // ── Reset all retry/reconnect state ────────────────────────────────────
    resetRetries: () =>
      set((state) => {
        state.retryCount = 0;
        state.lastError = null;
        state.reconnectDelay = 0;
        state.disconnectedAt = null;
      }),

    // ── Force retry from offline state ─────────────────────────────────────
    forceRetry: () =>
      set((state) => {
        if (state.connectionStatus === "offline") {
          state.connectionStatus = "polling";
          state.retryCount = 0;
          state.lastError = null;
          state.reconnectDelay = 0;
        }
      }),
  }))
);
