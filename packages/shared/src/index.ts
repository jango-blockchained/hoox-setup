/**
 * @hoox/shared — Shared module for HOOX CLI and TUI
 *
 * Barrel export: re-exports all shared utilities, types, and stores.
 */
export { Colors } from "./colors"
export type { ColorKey } from "./colors"

export {
  formatNumber,
  formatCurrency,
  formatCompactCurrency,
  formatDuration,
  formatDurationCompact,
  formatTimestamp,
  formatRelativeTime,
  formatPercent,
  formatUptime,
  formatLatency,
  formatRequests,
  formatMemory,
  formatCpu,
} from "./formatters"

export { readConfigSync, readConfig, writeConfigSync, writeConfig, validateConfig } from "./config"
export type { HooxConfig } from "./config"

export { hooxFetch, type FetchOptions } from "./api-client"
export { streamSSE, parseSSELines, type SSEEvent } from "./sse"
export { restoreSession, saveSession, type SessionState } from "./session"
export { formatRelativeTime as formatRelativeTimeFromTime } from "./format-time"

// Re-export shared types
export type {
  WorkerInfo,
  Trade,
  Alert,
  LogEntry,
  SystemMetrics,
  ConnectionStatus,
  LogLevel,
  LogFilter,
} from "../types"

export type {
  ViewId,
  ModalState,
  ModalType,
  ALL_VIEWS,
  VIEW_LABELS,
  VIEW_ORDER,
  viewIndex,
} from "../../tui/src/types"
