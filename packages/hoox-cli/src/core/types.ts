import type { WorkerHealth } from "./types.js";

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
  lastError?: CLIError;
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
  deployWorker(workerName: string): Promise<void>;
  testConnection(): Promise<boolean>;
  getWorkerMetrics(workerName: string): Promise<WorkerHealth>;
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
