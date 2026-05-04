export interface CommandOption {
  flag: string;
  short?: string;
  type: "string" | "boolean";
  description?: string;
  default?: string | boolean;
}

export interface CommandContext {
  observer: Observer;
  engine: Engine;
  adapters: {
    cloudflare: CloudflareAdapter;
    bun: BunAdapter;
    workers: WorkersAdapter;
  };
  cwd: string;
  args?: Record<string, unknown>;
}

export interface Command {
  name: string;
  description: string;
  options?: CommandOption[];
  execute(ctx: CommandContext): Promise<void>;
}

export interface Observer {
  getState(): AppState;
  setState(partial: Partial<AppState>): void;
  subscribe(listener: StateListener): UnsubscribeFn;
  emit(event: string, data?: unknown): void;
  on(event: string, handler: EventHandler): UnsubscribeFn;
}

export type StateListener = (state: AppState) => void;
export type EventHandler = (data: unknown) => void;
export type UnsubscribeFn = () => void;

export interface AppState {
  currentCommand?: string;
  commandStatus: "idle" | "running" | "success" | "error";
  lastError?: Error;
  workers: Record<string, WorkerHealth>;
  system: {
    bunVersion: string;
    memoryUsage: NodeJS.MemoryUsage;
    cloudflareQuota?: { remaining: number; limit: number };
    apiRateLimits?: Record<string, { remaining: number; resetAt: Date }>;
  };
  wizard?: unknown;
}

export interface WorkerHealth {
  name: string;
  status: "healthy" | "degraded" | "down";
  lastDeployed?: string;
  errorRate?: number;
  responseTime?: number;
}

export interface Engine {
  initialize(): Promise<void>;
  startListening(): void;
  stopListening(): void;
}

export interface CloudflareAdapter {
  // Worker methods
  deployWorker(workerName: string): Promise<void>;
  testConnection(): Promise<boolean>;
  getWorkerHealth(workerName: string): Promise<WorkerHealth>;
  
  // D1 Database methods
  listD1Databases(): Promise<Array<{ uuid: string; name: string; title: string }>>;
  createD1Database(name: string): Promise<{ uuid: string; name: string; title: string }>;
  deleteD1Database(uuid: string): Promise<void>;
  
  // KV Namespace methods
  listKVNamespaces(): Promise<Array<{ id: string; title: string }>>;
  createKVNamespace(title: string): Promise<{ id: string; title: string }>;
  deleteKVNamespace(id: string): Promise<void>;
  
  // R2 Bucket methods
  listR2Buckets(): Promise<Array<{ name: string }>>;
  createR2Bucket(name: string): Promise<{ name: string }>;
  deleteR2Bucket(name: string): Promise<void>;
  
  // Queues methods
  listQueues(): Promise<Array<{ queue_name: string }>>;
  createQueue(name: string): Promise<{ queue_name: string }>;
  deleteQueue(name: string): Promise<void>;
  
  // Secrets methods
  listSecrets(workerName: string): Promise<Array<{ name: string; created: string; version: number; expires_on?: string }>>;
  getSecret(workerName: string, name: string): Promise<{ name: string; created: string; version: number; expires_on?: string }>;
  setSecret(workerName: string, name: string, value: string): Promise<void>;
  deleteSecret(workerName: string, name: string): Promise<void>;
  
  // Zones methods
  listZones(): Promise<Array<{ id: string; name: string; status: string }>>;
  listDNSRecords(zoneId: string): Promise<Array<{ id: string; type: string; name: string; content: string }>>;
  addDNSRecord(zoneId: string, record: { type: string; name: string; content: string; priority?: number }): Promise<{ id: string }>;
  deleteDNSRecord(zoneId: string, recordId: string): Promise<void>;
}

export interface BunAdapter {
  promptSecret(prompt: string): Promise<string>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  openSQLite(path: string): Bun.SQL;
  loadEnv(): Record<string, string>;
}

export interface WorkersAdapter {
  callServiceBinding(worker: string, method: string, data?: unknown): Promise<unknown>;
}

export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "CLIError";
  }
}
