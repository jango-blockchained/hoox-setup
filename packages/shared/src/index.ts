/**
 * @hoox/shared — Shared module for HOOX CLI and TUI
 *
 * Barrel export: re-exports all shared utilities, types, stores, and TUI helpers.
 */

// ── Legal boilerplate ─────────────────────────────────────────────────────

export {
  COPYRIGHT,
  TRADEMARKS,
  TRADEMARK_NOTICE,
  DISCLAIMER,
  FULL_LEGAL_NOTICE,
  DISCLAIMER_HEADER,
} from "./legal";

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
} from "./types";
export {
  TradeActionSchema,
  WebhookPayloadSchema,
  TradeSignalSchema,
  PositionSchema,
  BalanceSchema,
} from "./types";
export type { TradeAction, WebhookPayload, TradeSignal } from "./types";
export { KVKeys } from "./kvKeys";
export {
  toError,
  Errors,
  createJsonResponse,
  createSuccessResponse,
  createErrorResponse,
} from "./errors";

export { BaseExchangeClient, ExchangeRouter } from "./exchange-client";
export type {
  ExchangeName,
  ExchangeConfig,
  TradeParams,
  OrderResponse,
  Position,
  IExchangeProvider,
} from "./exchange-client";
export { logKvTimestamp, headersToObject } from "./kvUtils";
export type { EnvWithKV } from "./kvUtils";
export { trackAnalytics } from "./analytics";
export type { AnalyticsEnv } from "./analytics";
export { healthCheck } from "./health";
export type { HealthCheckOptions } from "./health";
export { createQueueHandler } from "./queue-handler";
export type { QueueHandlerOptions } from "./queue-handler";
export { D1Repository } from "./d1/index";
export { serviceFetch } from "./service-bindings";
export type {
  TradeRecord,
  PositionRecord,
  BalanceRecord,
  SystemLogRecord,
  TradeSignalRecord,
  D1QueryResult,
  BatchStatement,
} from "./d1/index";

// ── Test utilities ─────────────────────────────────────────────────────────

export * from "./test-utils";

// ── New TUI shared exports ────────────────────────────────────────────────

export { Colors } from "./colors";
export type { ColorKey } from "./colors";

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
} from "./formatters";

export {
  readConfigSync,
  readConfig,
  writeConfigSync,
  writeConfig,
  validateConfig,
} from "./config";
export type { HooxConfig } from "./config";

export { hooxFetch, WorkerAPIError } from "./api-client";
export { subscribeSSE } from "./sse";
export type { SSECallback, SSEStatusCallback } from "./sse";
export { restoreSession, saveSession } from "./session";
export type { SessionState } from "./session";
export { formatRelativeTime as formatRelativeTimeFromTime } from "./format-time";

// TUI-specific types
export type {
  ViewId,
  ModalState,
  WorkerStatus,
  WorkerInfo,
  TradeSide,
  Trade,
  AlertSeverity,
  Alert,
  LogLevel,
  LogEntry,
  SystemMetrics,
  ConnectionStatus,
  LogFilter,
  NotificationPreferences,
} from "./types";

// ── Wizard engine ──────────────────────────────────────────────────────

export type {
  StepId,
  WorkerPresetName,
  WorkerPreset,
  WorkerConfig,
  WorkersJsonConfig,
  IntegratedService,
  ProvisioningPlan,
  ProvisionResult,
  WizardCloudflareConfig,
  WizardState,
  StepDefinition,
} from "./wizard";
export type { Provisioner } from "./wizard";
export {
  WizardEngine,
  PRESETS,
  WORKER_DEPENDENCIES,
  INTEGRATIONS,
  resolveDependencies,
  serializeState,
  deserializeState,
  WIZARD_STATE_PATH,
} from "./wizard";

// ── Worker Manifest Schema ──────────────────────────────────────────────

export * from "./schemas/index.js";

// Zustand stores
export { useUIStore } from "./stores/ui-store";
export { useServiceStore } from "./stores/service-store";
export { useConfigStore } from "./stores/config-store";
export type { UIState } from "./stores/ui-store";
export type { ServiceState } from "./stores/service-store";
export type { ConfigState } from "./stores/config-store";
