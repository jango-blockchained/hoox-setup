/** @jsxImportSource @opentui/react */
/**
 * Dashboard View — System health overview with service grid, alerts, and quick stats.
 *
 * Layout (vertical):
 *   1. Header: "DASHBOARD" title + animated connection status dot
 *   2. KillSwitchStatusBadge: live trade kill-switch indicator
 *   3. ServiceHealthGrid: worker cards with name + status indicator
 *   4. AlertsPanel: scrollable box with recent alerts, newest first
 *   5. QuickStatsRow: 4 metric cards with large numbers
 *
 * Follows Pattern 1 (View Composition) and Pattern 2 (Store Subscription).
 * Colors from design tokens via @jango-blockchained/hoox-shared. No CSS, no DOM.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { Colors, useServiceStore } from "@jango-blockchained/hoox-shared";
import { ErrorBoundary } from "../shared/error-boundary";
import { StatusDot } from "../shared/status-dot";
import { cliBridge } from "../../services/cli-bridge";
import type { AlertSeverity } from "@jango-blockchained/hoox-shared";
import type { ModelHealth, AgentHealthResult } from "../../services/cli-bridge";
import { showConfirm } from "../ui/dialog";
import type { DialogHandle } from "../ui/dialog";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DashboardViewProps {
  /** Dialog handle for confirm prompts (from useDialog context) */
  dialog?: DialogHandle;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Severity-based color keys for alert text */
const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  info: Colors.info,
  warning: Colors.warning,
  error: Colors.error,
  critical: Colors.error, // critical gets same red as error, but bold
};

/** Severity label prefix */
const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "INFO",
  warning: "WARN",
  error: "ERR",
  critical: "CRIT",
};

/** Maximum alerts shown in the panel */
const MAX_VISIBLE_ALERTS = 50;

// ─── Number Formatter (Bebas-style large numbers) ────────────────────────────

/**
 * Format a number for the stats cards.
 * - ≥1M: "1.2M"
 * - ≥1K: "12.3K"
 * - else: comma-separated integer
 * - P&L gets +/- prefix
 */
function formatStatNumber(value: number, isPnl = false): string {
  if (isPnl) {
    const sign = value >= 0 ? "+" : "-";
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${abs.toFixed(2)}`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

/**
 * Format a timestamp (ms) to HH:MM:SS for alert display.
 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return [
    d.getHours().toString().padStart(2, "0"),
    d.getMinutes().toString().padStart(2, "0"),
    d.getSeconds().toString().padStart(2, "0"),
  ].join(":");
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/**
 * KillSwitchStatusBadge — Compact trade kill-switch indicator for the dashboard
 * header. Auto-refreshes on mount and shows the engaged/released state with a
 * color-coded status dot. Errors degrade gracefully (badge just shows UNKNOWN).
 */
function KillSwitchStatusBadge() {
  const [state, setState] = useState<"engaged" | "released" | "unknown">(
    "unknown"
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await cliBridge.monitorKillSwitch("show");
      if (cancelled) return;
      if (result.success && result.data) {
        setState(result.data.engaged ? "engaged" : "released");
      } else {
        setState("unknown");
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    state === "engaged"
      ? "KILL SWITCH ENGAGED"
      : state === "released"
        ? "KILL SWITCH RELEASED"
        : "KILL SWITCH ?";
  const color =
    state === "engaged"
      ? Colors.error
      : state === "released"
        ? Colors.success
        : Colors.muted;
  const dotStatus: "operational" | "down" =
    state === "engaged"
      ? "down"
      : state === "released"
        ? "operational"
        : "down";

  return (
    <box flexDirection="row" gap={1}>
      <StatusDot status={dotStatus} pulse={state === "released"} />
      <text fg={color} bold={state === "engaged"}>
        {label}
      </text>
    </box>
  );
}

/**
 * DashboardHeader — view title with animated connection status
 * and auto-repair button.
 */
function DashboardHeader({
  onRefresh,
  onRunAutoRepair,
  autoRepairRunning,
}: {
  onRefresh?: () => void;
  onRunAutoRepair?: () => void;
  autoRepairRunning?: boolean;
}) {
  const connectionStatus = useServiceStore((s) => s.connectionStatus);

  const statusLabel: Record<string, string> = {
    connected: "CONNECTED",
    polling: "POLLING",
    reconnecting: "RECONNECTING",
    offline: "OFFLINE",
  };

  return (
    <box flexDirection="row" gap={2} paddingBottom={1}>
      <text fg={Colors.accent} bold>
        DASHBOARD
      </text>
      <box flexDirection="row" gap={1}>
        <StatusDot
          status={
            connectionStatus === "connected"
              ? "operational"
              : connectionStatus === "polling"
                ? "degraded"
                : "down"
          }
          pulse={connectionStatus === "connected"}
        />
        <text dim fg={Colors.muted}>
          {statusLabel[connectionStatus] ?? connectionStatus.toUpperCase()}
        </text>
        <text fg={Colors.muted} onMouseUp={onRefresh}>
          [REFRESH]
        </text>
        <text
          fg={autoRepairRunning ? Colors.warning : Colors.accent}
          bold={!autoRepairRunning}
          dim={autoRepairRunning}
          onMouseUp={autoRepairRunning ? undefined : onRunAutoRepair}
        >
          {autoRepairRunning ? "[REPAIRING...]" : "[AUTO-REPAIR]"}
        </text>
      </box>
    </box>
  );
}

/**
 * ServiceHealthGrid — displays all workers as a grid of status cards.
 * Each card shows: [█ ▌ ░] WORKER_NAME
 * Limited to first 10 workers (fits the dashboard layout).
 */
function ServiceHealthGrid() {
  const workers = useServiceStore((s) => s.workers);

  // Show first 10 workers (dashboard is an overview)
  const visibleWorkers = useMemo(() => workers.slice(0, 10), [workers]);

  if (workers.length === 0) {
    return (
      <box flexDirection="column" paddingY={1}>
        <text fg={Colors.muted} dim>
          No workers connected — waiting for data…
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="column" gap={0}>
      {/* Section label */}
      <text fg={Colors.foreground} bold dim>
        SERVICE HEALTH
      </text>

      {/* 2 rows × 5 columns grid */}
      <box
        flexDirection="row"
        flexWrap="wrap"
        gap={1}
        paddingTop={1}
        paddingBottom={1}
      >
        {visibleWorkers.map((worker, i) => (
          <box
            key={worker.id}
            flexDirection="row"
            width={28}
            gap={1}
            paddingLeft={1}
            paddingRight={1}
          >
            <StatusDot status={worker.status} />
            <text fg={Colors.foreground}>{worker.name}</text>
            {/* Fill remaining space with muted dots for alignment */}
            {i >= visibleWorkers.length && (
              <text fg={Colors.dim} dim>
                —
              </text>
            )}
          </box>
        ))}
      </box>

      {/* Fill empty slots in grid to maintain 10-card layout */}
      {visibleWorkers.length < 10 && (
        <box flexDirection="row" flexWrap="wrap" gap={1}>
          {Array.from({ length: 10 - visibleWorkers.length }).map((_, i) => (
            <box
              key={`empty-${i}`}
              flexDirection="row"
              width={28}
              gap={1}
              paddingLeft={1}
              paddingRight={1}
            >
              <text fg={Colors.dim} dim>
                —
              </text>
              <text fg={Colors.dim} dim>
                —
              </text>
            </box>
          ))}
        </box>
      )}
    </box>
  );
}

/**
 * AlertsPanel — scrollable list of recent alerts, newest first.
 * Each alert row shows: [SEV] HH:MM:SS — message
 * Color-coded by severity. Scrollable with ↑↓ keys.
 */
function AlertsPanel() {
  const alerts = useServiceStore((s) => s.alerts);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Newest first, limited
  const sortedAlerts = useMemo(() => {
    return [...alerts]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_VISIBLE_ALERTS);
  }, [alerts]);

  // Keyboard: scroll through alerts
  useKeyboard((key) => {
    if (key.name === "up") {
      setScrollOffset((o) => Math.max(0, o - 1));
    } else if (key.name === "down") {
      setScrollOffset((o) =>
        Math.min(Math.max(0, sortedAlerts.length - 1), o + 1)
      );
    }
  });

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Section label */}
      <text fg={Colors.foreground} bold dim>
        ALERTS
      </text>

      {sortedAlerts.length === 0 ? (
        <text fg={Colors.muted} dim paddingTop={1}>
          No alerts
        </text>
      ) : (
        <scrollbox
          width="100%"
          flexGrow={1}
          height={8}
          border={true}
          borderStyle="single"
          borderColor={Colors.border}
          paddingTop={0}
        >
          {sortedAlerts.map((alert, i) => {
            const color = SEVERITY_COLOR[alert.severity];
            const label = SEVERITY_LABEL[alert.severity];
            const isCritical = alert.severity === "critical";
            const isSelected = i === scrollOffset;

            return (
              <box
                key={alert.id}
                flexDirection="row"
                gap={1}
                backgroundColor={isSelected ? Colors.card : undefined}
              >
                {/* Severity badge */}
                <text fg={color} bold={isCritical} dim={!isCritical}>
                  [{label}]
                </text>

                {/* Timestamp */}
                <text fg={Colors.muted} dim>
                  {formatTime(alert.timestamp)}
                </text>

                {/* Divider */}
                <text fg={Colors.dim} dim>
                  —
                </text>

                {/* Message */}
                <text fg={color} bold={isCritical} dim={alert.acknowledged}>
                  {alert.message.length > 60
                    ? alert.message.slice(0, 57) + "…"
                    : alert.message}
                </text>

                {/* Acknowledged marker */}
                {alert.acknowledged && (
                  <text fg={Colors.dim} dim>
                    ✓
                  </text>
                )}
              </box>
            );
          })}
        </scrollbox>
      )}

      {/* Scroll hint */}
      {sortedAlerts.length > 0 && (
        <text fg={Colors.dim} dim>
          ↑↓ scroll · {scrollOffset + 1}/{sortedAlerts.length}
        </text>
      )}
    </box>
  );
}

/**
 * MetricCard — a single stat card with label and large formatted number.
 */

// ─── Auto-Repair Types ────────────────────────────────────────────────────────

/**
 * A single fix action result from `hoox check fix`.
 * Mirrors the CLI's FixAction shape (`packages/cli/src/commands/check/types.ts`).
 */
interface RepairFixItem {
  /** Human-readable description of the fix. */
  description: string;
  /** Type of fix: file, binding, flag, or config. */
  type: "file" | "binding" | "flag" | "config";
  /** Target path or identifier. */
  target: string;
  /** Whether the fix was successfully applied. */
  applied: boolean;
  /** Error message if application failed. */
  error?: string;
  /** Timestamp when the fix was attempted. */
  timestamp: number;
}

/**
 * UI state for the Auto-Repair results panel.
 */
type RepairState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "results"; items: RepairFixItem[]; durationMs: number };

// ─── Auto-Repair Sub-Components ───────────────────────────────────────────────

/**
 * Status badge for a single repair item: APPLIED, FAILED, or SKIPPED.
 */
function RepairStatusBadge({
  status,
}: {
  status: "applied" | "failed" | "skipped";
}) {
  if (status === "applied") {
    return (
      <text fg={Colors.success} bold>
        [APPLIED]
      </text>
    );
  }
  if (status === "failed") {
    return (
      <text fg={Colors.error} bold>
        [FAILED]
      </text>
    );
  }
  return (
    <text fg={Colors.warning} bold>
      [SKIPPED]
    </text>
  );
}

/**
 * Format a timestamp (ms) to HH:MM:SS for display.
 */
function formatRepairTime(ts: number): string {
  const d = new Date(ts);
  return [
    d.getHours().toString().padStart(2, "0"),
    d.getMinutes().toString().padStart(2, "0"),
    d.getSeconds().toString().padStart(2, "0"),
  ].join(":");
}

/**
 * AutoRepairPanel — shows repair results below the health section.
 * Displays each fix item with timestamp, description, and status.
 * Persists until the user dismisses with ESC or the [DISMISS] button.
 */
function AutoRepairPanel({
  state,
  onDismiss,
  onRerun,
}: {
  state: RepairState;
  onDismiss: () => void;
  onRerun: () => void;
}) {
  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="single"
      borderColor={Colors.accent}
      backgroundColor={Colors.card}
      padding={1}
      gap={0}
    >
      {/* Header row */}
      <box flexDirection="row" gap={2}>
        <text fg={Colors.accent} bold>
          AUTO-REPAIR RESULTS
        </text>
        {state.kind === "results" && (
          <>
            <text fg={Colors.success} bold>
              {state.items.filter((i) => i.applied).length} applied
            </text>
            <text
              fg={
                state.items.filter((i) => i.error).length > 0
                  ? Colors.error
                  : Colors.muted
              }
              bold={state.items.filter((i) => i.error).length > 0}
            >
              {state.items.filter((i) => i.error).length} failed
            </text>
            <text fg={Colors.muted} dim>
              {`(${(state.durationMs / 1000).toFixed(1)}s)`}
            </text>
          </>
        )}
        {state.kind === "running" && (
          <text fg={Colors.info} bold>
            running...
          </text>
        )}
        <text fg={Colors.muted}>{"  "}</text>
        <text fg={Colors.accent} bold onMouseUp={onRerun}>
          [ RE-RUN ]
        </text>
        <text fg={Colors.warning} bold onMouseUp={onDismiss}>
          [ DISMISS ]
        </text>
      </box>

      {/* Divider */}
      <text fg={Colors.border} dim>
        {"─".repeat(80)}
      </text>

      {/* Error state */}
      {state.kind === "error" && (
        <box flexDirection="column" gap={0} paddingTop={1}>
          <text fg={Colors.error} bold>
            Auto-repair failed to run:
          </text>
          <text fg={Colors.foreground}>{state.message}</text>
        </box>
      )}

      {/* Running state */}
      {state.kind === "running" && (
        <box flexDirection="column" gap={0} paddingTop={1}>
          <text fg={Colors.muted} dim>
            Running `hoox check fix` — this may take up to 60 seconds.
          </text>
        </box>
      )}

      {/* Results state */}
      {state.kind === "results" && (
        <box flexDirection="column" gap={0} paddingTop={1}>
          {state.items.length === 0 ? (
            <text fg={Colors.muted} dim>
              No repairs were needed — all checks passed.
            </text>
          ) : (
            state.items.map((item, idx) => {
              const status: "applied" | "failed" | "skipped" = item.error
                ? "failed"
                : item.applied
                  ? "applied"
                  : "skipped";
              return (
                <box
                  key={`repair-${idx}-${item.target}`}
                  flexDirection="column"
                  gap={0}
                >
                  <box flexDirection="row" gap={1} paddingLeft={1}>
                    <RepairStatusBadge status={status} />
                    <text fg={Colors.foreground} bold={status === "failed"}>
                      {item.description}
                    </text>
                  </box>
                  {/* Target */}
                  <text fg={Colors.dim} dim paddingLeft={6}>
                    {"  target: "}
                    {item.target}
                  </text>
                  {/* Error details */}
                  {item.error && (
                    <text fg={Colors.error} paddingLeft={6}>
                      {"  error: "}
                      {item.error}
                    </text>
                  )}
                </box>
              );
            })
          )}
        </box>
      )}
    </box>
  );
}

function MetricCard({
  label,
  value,
  color,
  isPnl = false,
}: {
  label: string;
  value: number;
  color: string;
  isPnl?: boolean;
}) {
  return (
    <box
      flexDirection="column"
      width={22}
      border={true}
      borderStyle="single"
      borderColor={Colors.border}
      backgroundColor={Colors.card}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Label (dim, small) */}
      <text fg={Colors.muted} dim>
        {label}
      </text>

      {/* Value (large, colored) */}
      <text fg={color} bold>
        {formatStatNumber(value, isPnl)}
      </text>
    </box>
  );
}

/**
 * QuickStatsRow — row of 4 metric cards from SystemMetrics.
 * P&L, Active Strategies, Daily Trades, AI Calls.
 */
function QuickStatsRow() {
  const metrics = useServiceStore((s) => s.metrics);

  // Default values when metrics is null/unavailable
  const totalPnl = metrics?.totalPnl ?? 0;
  const activeStrategies = metrics?.activeStrategies ?? 0;
  const dailyTrades = metrics?.dailyTrades ?? 0;
  const aiCalls = metrics?.aiCalls ?? 0;

  return (
    <box flexDirection="column" gap={0}>
      <text fg={Colors.foreground} bold dim>
        QUICK STATS
      </text>

      <box flexDirection="row" gap={1} paddingTop={1}>
        <MetricCard
          label="P&L"
          value={totalPnl}
          color={totalPnl >= 0 ? Colors.success : Colors.error}
          isPnl
        />
        <MetricCard
          label="ACTIVE STRATEGIES"
          value={activeStrategies}
          color={Colors.accent}
        />
        <MetricCard
          label="DAILY TRADES"
          value={dailyTrades}
          color={Colors.info}
        />
        <MetricCard label="AI CALLS" value={aiCalls} color={Colors.accent} />
      </box>

      {/* Empty state when metrics unavailable */}
      {metrics === null && (
        <text fg={Colors.muted} dim paddingTop={1}>
          Waiting for metrics data…
        </text>
      )}
    </box>
  );
}

/** Polling interval for AI model health checks (30 seconds). */
const MODEL_HEALTH_POLL_MS = 30_000;

/**
 * Map model status to a color for the status indicator.
 * online → green, degraded → yellow/warning, offline → red/error
 */
function modelStatusColor(status: ModelHealth["status"]): string {
  if (status === "online") return Colors.success;
  if (status === "degraded") return Colors.warning;
  return Colors.error;
}

/**
 * Map model status to a StatusDot-compatible status string.
 */
function modelStatusToDot(
  status: ModelHealth["status"]
): "operational" | "degraded" | "down" {
  if (status === "online") return "operational";
  if (status === "degraded") return "degraded";
  return "down";
}

/**
 * ModelHealthRow — a single expandable row showing one AI provider.
 * Click to expand/collapse detailed stats (latency, daily usage, error).
 */
function ModelHealthRow({
  model,
  isExpanded,
  onToggle,
}: {
  model: ModelHealth;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const color = modelStatusColor(model.status);

  return (
    <box flexDirection="column" gap={0}>
      {/* Main row — always visible */}
      <box flexDirection="row" gap={1} paddingLeft={1}>
        {/* Expand/collapse indicator */}
        <text fg={Colors.muted} dim>
          {isExpanded ? "▼" : "▶"}
        </text>

        {/* Status dot */}
        <StatusDot status={modelStatusToDot(model.status)} />

        {/* Provider name */}
        <text fg={Colors.foreground} bold>
          {model.name}
        </text>

        {/* Model identifier (truncated) */}
        <text fg={Colors.muted} dim>
          {model.model.length > 30
            ? model.model.slice(0, 27) + "…"
            : model.model}
        </text>

        {/* Expand hint */}
        <text fg={Colors.accent} onMouseUp={onToggle}>
          [DETAILS]
        </text>
      </box>

      {/* Expanded details */}
      {isExpanded && (
        <box flexDirection="column" gap={0} paddingLeft={6}>
          {/* Latency */}
          <text fg={Colors.muted} dim>
            {"  latency: "}
            <text fg={color}>
              {model.latencyMs !== null ? `${model.latencyMs}ms` : "-"}
            </text>
          </text>

          {/* Daily requests */}
          <text fg={Colors.muted} dim>
            {"  daily requests: "}
            <text fg={Colors.info}>
              {model.dailyRequests !== null
                ? model.dailyRequests.toLocaleString()
                : "-"}
            </text>
          </text>

          {/* Error message (if any) */}
          {model.error && (
            <text fg={Colors.error}>
              {"  error: "}
              {model.error}
            </text>
          )}
        </box>
      )}
    </box>
  );
}

/**
 * ModelHealthSection — displays health status of all configured AI providers.
 *
 * Auto-refreshes every 30 seconds when the dashboard is active.
 * Supports multiple providers: Workers AI, OpenAI, Anthropic, Google, Azure.
 * Click on a provider to expand detailed stats (latency, daily usage, error).
 */
function ModelHealthSection() {
  const [providers, setProviders] = useState<ModelHealth[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const fetchHealth = useCallback(async () => {
    const result = await cliBridge.agentHealthCheck();
    if (result.success && result.data) {
      setProviders(result.data.providers);
      setLastRefresh(Date.now());
    }
    setLoading(false);
  }, []);

  // Initial fetch + 30s polling
  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(() => {
      void fetchHealth();
    }, MODEL_HEALTH_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const toggleExpand = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  if (loading && providers.length === 0) {
    return (
      <box flexDirection="column" gap={0}>
        <text fg={Colors.foreground} bold dim>
          AI MODEL HEALTH
        </text>
        <text fg={Colors.muted} dim paddingTop={1}>
          Checking provider status…
        </text>
      </box>
    );
  }

  if (providers.length === 0) {
    return (
      <box flexDirection="column" gap={0}>
        <text fg={Colors.foreground} bold dim>
          AI MODEL HEALTH
        </text>
        <text fg={Colors.muted} dim paddingTop={1}>
          No AI providers configured
        </text>
      </box>
    );
  }

  // Summary counts
  const onlineCount = providers.filter((p) => p.status === "online").length;
  const degradedCount = providers.filter((p) => p.status === "degraded").length;
  const offlineCount = providers.filter((p) => p.status === "offline").length;

  return (
    <box flexDirection="column" gap={0}>
      {/* Section header */}
      <box flexDirection="row" gap={2}>
        <text fg={Colors.foreground} bold dim>
          AI MODEL HEALTH
        </text>

        {/* Status summary badges */}
        {onlineCount > 0 && (
          <text fg={Colors.success} dim>
            {onlineCount} online
          </text>
        )}
        {degradedCount > 0 && (
          <text fg={Colors.warning} dim>
            {degradedCount} degraded
          </text>
        )}
        {offlineCount > 0 && (
          <text fg={Colors.error} dim>
            {offlineCount} offline
          </text>
        )}

        {/* Last refresh timestamp */}
        {lastRefresh !== null && (
          <text fg={Colors.muted} dim>
            {`updated ${new Date(lastRefresh).toLocaleTimeString()}`}
          </text>
        )}
      </box>

      {/* Provider list */}
      <box
        flexDirection="column"
        gap={0}
        paddingTop={1}
        border={true}
        borderStyle="single"
        borderColor={Colors.border}
        backgroundColor={Colors.card}
        paddingLeft={1}
        paddingRight={1}
      >
        {providers.map((model, index) => (
          <ModelHealthRow
            key={model.name}
            model={model}
            isExpanded={expandedIndex === index}
            onToggle={() => toggleExpand(index)}
          />
        ))}
      </box>
    </box>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

/**
 * DashboardView — system health overview.
 *
 * Composes: Header → ServiceHealthGrid → AutoRepairPanel → AlertsPanel → QuickStatsRow
 * Wrapped in an ErrorBoundary for crash recovery.
 *
 * View subscribes to service-store (workers, alerts, metrics, connectionStatus)
 * and re-renders on data changes via Zustand selectors.
 */
export function DashboardView({ dialog }: DashboardViewProps = {}) {
  const [repairState, setRepairState] = useState<RepairState>({ kind: "idle" });

  const handleRefresh = async () => {
    const result = await cliBridge.monitorStatus();
    if (result.success) {
      // Clear any previous CLI error and refresh the data view.
      // Note: failed CLI calls propagate to the status bar automatically
      // via the global error sink registered in app.tsx.
      useServiceStore.getState().setLastErrorDetails(null);
      await useServiceStore.getState().fetchWorkers();
    }
  };

  const handleRunAutoRepair = useCallback(async () => {
    // Show confirmation dialog before running repair
    // When dialog is not available, repair runs without confirmation (dev mode)
    if (dialog) {
      const confirmed = await showConfirm(dialog, {
        title: "Run Auto-Repair?",
        message:
          "Auto-repair will apply non-destructive fixes to your configuration. " +
          "This creates placeholder .dev.vars files, adds compatibility flags, " +
          "and ensures worker configs are valid.",
        confirmLabel: "Run Repair",
        cancelLabel: "Cancel",
      });
      if (!confirmed) return;
    }

    setRepairState({ kind: "running" });
    try {
      const result = await cliBridge.checkFix();
      if (!result.success) {
        setRepairState({
          kind: "error",
          message: result.stderr || result.stdout || "unknown error from CLI",
        });
        useServiceStore.getState().addAlert({
          id: `repair-${Date.now()}`,
          type: "config",
          severity: "warning",
          message: `Auto-repair failed: ${result.stderr || result.stdout || "unknown error"}`,
          timestamp: Date.now(),
          acknowledged: false,
        });
        return;
      }

      // Parse the FixReport from the CLI response
      const data = result.data as {
        actions?: Array<{
          description: string;
          type: string;
          target: string;
          applied: boolean;
          error?: string;
        }>;
        summary?: {
          total: number;
          applied: number;
          skipped: number;
          failed: number;
        };
      } | null;

      if (!data || !Array.isArray(data.actions)) {
        setRepairState({
          kind: "error",
          message: "CLI did not return a valid FixReport (missing actions).",
        });
        return;
      }

      const items: RepairFixItem[] = data.actions.map((action) => ({
        description: action.description ?? "Unknown fix",
        type: (action.type as RepairFixItem["type"]) ?? "config",
        target: action.target ?? "",
        applied: Boolean(action.applied),
        error: action.error,
        timestamp: Date.now(),
      }));

      setRepairState({ kind: "results", items, durationMs: result.duration });

      // Add summary alert
      const applied = items.filter((i) => i.applied).length;
      const failed = items.filter((i) => i.error).length;
      useServiceStore.getState().addAlert({
        id: `repair-${Date.now()}`,
        type: "config",
        severity: failed > 0 ? "warning" : "info",
        message:
          failed > 0
            ? `Auto-repair completed: ${applied} applied, ${failed} failed`
            : `Auto-repair completed: ${applied} fix(es) applied`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRepairState({ kind: "error", message });
      useServiceStore.getState().addAlert({
        id: `repair-err-${Date.now()}`,
        type: "config",
        severity: "error",
        message: `Auto-repair error: ${message}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
  }, [dialog]);

  const dismissRepairPanel = useCallback(() => {
    setRepairState({ kind: "idle" });
  }, []);

  /** Re-run the auto-repair. */
  const rerunRepair = useCallback(() => {
    void handleRunAutoRepair();
  }, [handleRunAutoRepair]);

  // Dismiss repair panel on ESC key when visible
  useKeyboard((key) => {
    if (repairState.kind !== "idle" && key.name === "escape") {
      dismissRepairPanel();
    }
  });

  useEffect(() => {
    const runHealthCheck = async () => {
      const health = await cliBridge.checkHealth();
      if (health.success) {
        useServiceStore.getState().setLastErrorDetails(null);
        await useServiceStore.getState().fetchWorkers();
      }
      // Failure path: handled by the global error sink in app.tsx.
    };
    runHealthCheck();
  }, []);

  return (
    <ErrorBoundary viewName="Dashboard">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        {/* 1. Header: title + connection status */}
        <DashboardHeader
          onRefresh={handleRefresh}
          onRunAutoRepair={handleRunAutoRepair}
          autoRepairRunning={repairState.kind === "running"}
        />

        {/* 2. Kill-switch status badge — trading safety at a glance */}
        <KillSwitchStatusBadge />

        {/* Divider */}
        <text fg={Colors.border} dim>
          {""}
          {"─".repeat(80)}
        </text>

        {/* 3. Service health grid */}
        <ServiceHealthGrid />

        {/* Auto-repair results panel — persists until dismissed or ESC */}
        {repairState.kind !== "idle" && (
          <AutoRepairPanel
            state={repairState}
            onDismiss={dismissRepairPanel}
            onRerun={rerunRepair}
          />
        )}

        {/* 4. Alerts panel */}
        <AlertsPanel />

        {/* 5. Quick stats row */}
        <QuickStatsRow />

        {/* 6. AI model health section */}
        <ModelHealthSection />
      </box>
    </ErrorBoundary>
  );
}
