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

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// --- Trade and webhook types (consolidated) ---

export type TradeAction = "LONG" | "SHORT" | "CLOSE_LONG" | "CLOSE_SHORT";

export interface WebhookPayload {
  exchange: string;
  action: TradeAction;
  symbol: string;
  quantity: number;
  price?: number;
  orderType?: string;
  leverage?: number;
}

export interface TradeSignal {
  id?: number;
  source: string;
  symbol: string;
  action: TradeAction;
  price?: number;
  quantity: number;
  leverage?: number;
  status?: "pending" | "executed" | "failed" | "skipped";
  createdAt?: string;
  executedAt?: string;
  error?: string;
}

export interface QueryPayload {
  query: string;
  params?: unknown[];
}

export interface BatchPayload {
  statements: QueryPayload[];
}
