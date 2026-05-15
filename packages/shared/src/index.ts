/**
 * @hoox/shared — Shared module for HOOX CLI and TUI
 *
 * Barrel export: re-exports all shared utilities, types, stores, and TUI helpers.
 */

// ── Original shared exports (CLI + Workers) ──────────────────────────────

export type {
  StandardResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  WorkerServiceBinding,
  WorkerD1Binding,
  WorkerSecretsStoreBinding,
  WorkerQueueConfig,
  HousekeepingCheck,
  HousekeepingPayload,
  HousekeepingSummary,
  SettingsPayload,
  ProcessRequestBody,
  BaseEnv,
  Result,
} from "./types.js";
export {
  TradeActionSchema,
  WebhookPayloadSchema,
  TradeSignalSchema,
  PositionSchema,
  BalanceSchema,
} from "./types.js";
export type { TradeAction, WebhookPayload, TradeSignal } from "./types.js";
export { KVKeys } from "./kvKeys.js";
export {
  toError,
  Errors,
  createJsonResponse,
  createSuccessResponse,
  createErrorResponse,
} from "./errors.js";

export { BaseExchangeClient } from "./exchange-client.js";
export type {
  ExchangeName,
  ExchangeConfig,
  TradeParams,
  OrderResponse,
  Position,
} from "./exchange-client.js";
export {
  logKvTimestamp,
  headersToObject,
  kvTimestampMiddleware,
} from "./kvUtils.js";
export type { EnvWithKV } from "./kvUtils.js";
export { trackAnalytics } from "./analytics.js";
export type { AnalyticsEnv } from "./analytics.js";
export { healthCheck } from "./health.js";
export type { HealthCheckOptions } from "./health.js";
export { D1Repository } from "./d1/index.js";
export { serviceFetch } from "./service-bindings.js";
export type {
  TradeRecord,
  PositionRecord,
  BalanceRecord,
  SystemLogRecord,
  TradeSignalRecord,
  D1QueryResult,
  BatchStatement,
} from "./d1/index.js";

// ── New TUI shared exports ────────────────────────────────────────────────

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

export { hooxFetch, WorkerAPIError } from "./api-client"
export { subscribeSSE } from "./sse"
export type { SSECallback, SSEStatusCallback } from "./sse"
export { restoreSession, saveSession } from "./session"
export type { SessionState } from "./session"
export { formatRelativeTime as formatRelativeTimeFromTime } from "./format-time"

// TUI-specific types
export type {
  WorkerInfo,
  Trade,
  Alert,
  LogEntry,
  SystemMetrics,
  ConnectionStatus,
  LogLevel,
  LogFilter,
} from "../../types"

// Zustand stores
export { useUIStore } from "../stores/ui-store"
export { useServiceStore } from "../stores/service-store"
export { useConfigStore } from "../stores/config-store"
export type { UIState } from "../stores/ui-store"
export type { ServiceState } from "../stores/service-store"
export type { ConfigState } from "../stores/config-store"
