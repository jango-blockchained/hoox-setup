// workers/analytics-worker/src/index.ts
import type { Env, DataPoint, TradePayload, TradeResult, WorkerPerfData, ApiCallData, SignalData, NotificationData } from "./types";
import { buildDataPoint } from "./helpers";
import { buildQuery } from "./query-builder";

// Service binding methods (called by other workers)
export async function writeDataPoint(data: DataPoint, env: Env): Promise<void> {
  env.ANALYTICS_ENGINE.writeDataPoint({
    blobs: data.blobs,
    doubles: data.doubles,
    indexes: data.indexes
  });
}

export async function trackTrade(
  payload: TradePayload,
  result: TradeResult,
  latencyMs: number,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.trade(payload, result, latencyMs);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackApiCall(
  worker: string,
  endpoint: string,
  latencyMs: number,
  success: boolean,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.apiCall(worker, endpoint, latencyMs, success);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackWorkerPerf(
  data: WorkerPerfData,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.workerPerf(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackSignal(
  data: SignalData,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.signal(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackNotification(
  data: NotificationData,
  env: Env
): Promise<void> {
  const dataPoint = buildDataPoint.notification(data);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

// Query methods (make HTTP calls to Cloudflare SQL API)
export async function getTradeMetrics(
  timeRange: { start: string; end: string },
  env: Env
): Promise<any> {
  const sql = buildQuery.getTradeMetrics(timeRange);
  return await executeQuery(sql, env);
}

export async function getTradesByExchange(
  exchange: string,
  limit: number = 100,
  env: Env
): Promise<any> {
  const sql = buildQuery.getTradesByExchange(exchange, limit);
  return await executeQuery(sql, env);
}

export async function getTradeSuccessRate(
  timeRange?: string,
  env: Env
): Promise<any> {
  const sql = buildQuery.getTradeSuccessRate(timeRange);
  return await executeQuery(sql, env);
}

export async function getWorkerPerformance(
  worker: string,
  timeRange?: string,
  env: Env
): Promise<any> {
  const sql = buildQuery.getWorkerPerformance(worker, timeRange);
  return await executeQuery(sql, env);
}

export async function getApiCallStats(
  exchange?: string,
  env: Env
): Promise<any> {
  const sql = buildQuery.getApiCallStats(exchange);
  return await executeQuery(sql, env);
}

export async function getSignalOutcomes(
  timeRange?: string,
  env: Env
): Promise<any> {
  const sql = buildQuery.getSignalOutcomes(timeRange);
  return await executeQuery(sql, env);
}

// Helper: Execute SQL query via Cloudflare API
async function executeQuery(sql: string, env: Env): Promise<any> {
  if (!env.CF_API_TOKEN) {
    throw new Error("CF_API_TOKEN not configured");
  }
  
  if (!env.CF_ACCOUNT_ID) {
    throw new Error("CF_ACCOUNT_ID not configured");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: sql
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Query failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// Fetch handler (for HTTP requests if needed later)
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    return new Response("Analytics Worker - use service bindings for write/query", {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};
