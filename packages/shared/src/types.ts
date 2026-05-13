import { z } from "zod";

// --- Zod Schemas (runtime-validated) ---

export const TradeActionSchema = z.enum([
  "LONG",
  "SHORT",
  "CLOSE_LONG",
  "CLOSE_SHORT",
]);

export const WebhookPayloadSchema = z
  .object({
    exchange: z.string().min(1),
    action: TradeActionSchema,
    symbol: z.string().min(1).max(20),
    quantity: z.number().positive().finite(),
    price: z.number().positive().finite().optional(),
    orderType: z.string().optional(),
    leverage: z.number().int().positive().optional(),
  })
  .strict();

export const TradeSignalSchema = z
  .object({
    id: z.number().int().positive().optional(),
    source: z.string().min(1),
    symbol: z.string().min(1),
    action: TradeActionSchema,
    price: z.number().positive().finite().optional(),
    quantity: z.number().positive().finite(),
    leverage: z.number().int().positive().optional(),
    status: z.enum(["pending", "executed", "failed", "skipped"]).optional(),
    createdAt: z.string().optional(),
    executedAt: z.string().optional(),
    error: z.string().optional(),
  })
  .strict();

export const PositionSchema = z
  .object({
    id: z.string(),
    symbol: z.string().min(1),
    side: TradeActionSchema,
    quantity: z.number().positive(),
    entry_price: z.number().positive(),
    current_price: z.number().positive(),
    unrealized_pnl: z.number(),
    timestamp: z.number().int().positive(),
  })
  .strict();

export const BalanceSchema = z
  .object({
    asset: z.string().min(1),
    free: z.number().min(0),
    locked: z.number().min(0),
    timestamp: z.number().int().positive(),
  })
  .strict();

// --- Existing types (backward compatible) ---

export interface StandardResponse {
  success: boolean;
  result?: unknown;
  error?: string | null;
  message?: string;
  tradeResult?: unknown;
  notificationResult?: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface WorkerServiceBinding {
  binding: string;
  service: string;
}

export interface WorkerD1Binding {
  binding: string;
  database_id?: string;
  database_name?: string;
}

export interface WorkerQueueConfig {
  producers?: { binding: string; queue: string }[];
  consumers?: { queue: string }[];
}

export interface WorkerSecretsStoreBinding {
  name?: string;
  secret_name: string;
  store_id?: string;
  binding?: string;
}

export interface WorkerConfigManifestLite {
  name?: string;
  account_id?: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
  pages_build_output_dir?: string;
  services?: WorkerServiceBinding[];
  d1_databases?: WorkerD1Binding[];
  secrets_store?: { bindings?: WorkerSecretsStoreBinding[] };
  secrets_store_secrets?: WorkerSecretsStoreBinding[];
  queues?: WorkerQueueConfig;
  durable_objects?: { bindings?: { name: string; class_name: string }[] };
  migrations?: { tag: string; new_sqlite_classes?: string[] }[];
}

export interface HousekeepingCheck {
  worker: string;
  type: "error" | "warning" | "info";
  message: string;
}

export interface HousekeepingSummary {
  errors: number;
  warnings: number;
  info: number;
}

export interface HousekeepingPayload {
  timestamp: string;
  totalWorkers: number;
  checkedWorkers: number;
  issues: HousekeepingCheck[];
  summary: HousekeepingSummary;
}

export interface SettingsPayload {
  worker: string;
  key: string;
  value: string | number | boolean;
}

// --- Types needed by shared middleware and router ---

export interface Env {
  [key: string]: any;
}

/**
 * Base environment type for workers with common Cloudflare bindings.
 * Workers should extend this with their specific bindings.
 */
export interface BaseEnv {
  /** Optional analytics service binding for tracking */
  ANALYTICS_SERVICE?: Fetcher;
  /** Optional KV namespace for configuration */
  CONFIG_KV?: KVNamespace;
  [key: string]: unknown;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// --- Trade and webhook types (consolidated) ---

export type TradeAction = z.infer<typeof TradeActionSchema>;

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export type TradeSignal = z.infer<typeof TradeSignalSchema>;

export interface QueryPayload {
  query: string;
  params?: unknown[];
}

export interface BatchPayload {
  statements: QueryPayload[];
}

// --- Internal service-to-service request types ---

/**
 * Generic process request body for internal worker-to-worker calls.
 * The payload type varies per worker (WebhookPayload, NotificationPayload, etc.)
 */
export interface ProcessRequestBody<T = unknown> {
  requestId?: string;
  internalAuthKey?: string;
  payload: T;
}
