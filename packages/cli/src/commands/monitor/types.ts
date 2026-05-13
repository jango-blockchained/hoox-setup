export interface WorkerHealthResult {
  worker: string;
  status: "healthy" | "degraded" | "unreachable";
  statusCode?: number;
  error?: string;
}

export interface MonitorStatusResult {
  workers: WorkerHealthResult[];
  healthyCount: number;
  degradedCount: number;
  unreachableCount: number;
}
