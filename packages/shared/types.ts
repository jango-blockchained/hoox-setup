// Shared types for the Hoox TUI dashboard
// Used by both CLI and TUI packages

// ─── View ────────────────────────────────────────────────────────────────────

export type ViewId =
  | "dashboard"
  | "workers"
  | "worker-detail"
  | "trade-monitor"
  | "logs-viewer"
  | "service-manager"
  | "config-editor"
  | "setup-wizard"
  | "settings";

export interface ModalState {
  type: "confirm" | "alert" | "prompt" | "custom";
  title: string;
  message?: string;
  data?: unknown;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export type WorkerStatus = "operational" | "degraded" | "down";

export interface WorkerInfo {
  id: string;
  name: string;
  status: WorkerStatus;
  uptime: number; // seconds
  cpu: number; // percent 0-100
  memory: number; // MB used
  requests: number;
  durableObjectCount: number;
  edgeCount: number;
  version?: string;
  lastDeployed?: number; // timestamp ms
}

// ─── Trade ───────────────────────────────────────────────────────────────────

export type TradeSide = "buy" | "sell";

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  price: number;
  quantity: number;
  timestamp: number; // ms
  exchange: string;
  strategy?: string;
  pnl?: number;
}

// ─── Alert ───────────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number; // ms
  workerId?: string;
  acknowledged: boolean;
  source?: string;
}

// ─── Log ─────────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number; // ms
  workerId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface SystemMetrics {
  totalWorkers: number;
  onlineWorkers: number;
  totalPnl: number;
  activeStrategies: number;
  dailyTrades: number;
  aiCalls: number;
  uptime: number; // seconds
  lastUpdated: number; // timestamp ms
}

// ─── Connection ──────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "connected"
  | "polling"
  | "offline"
  | "reconnecting";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface LogFilter {
  levels: LogLevel[];
  workers: string[];
  searchText: string;
}

export interface NotificationPreferences {
  alerts: boolean;
  trades: boolean;
  debug: boolean;
  system: boolean;
}
