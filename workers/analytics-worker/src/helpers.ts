import type { DataPoint, TradePayload, TradeResult, ApiCallData, WorkerPerfData, SignalData, NotificationData } from "./types";

export const buildDataPoint = {
  trade(payload: TradePayload, result: TradeResult, latencyMs: number): DataPoint {
    return {
      blobs: [
        "trade",
        "trade-worker",
        result.success ? "success" : "failure",
        payload.exchange,
        payload.symbol
      ],
      doubles: [payload.quantity, payload.price || 0, latencyMs],
      indexes: [payload.requestId || crypto.randomUUID()]
    };
  },

  apiCall(worker: string, endpoint: string, latencyMs: number, success: boolean): DataPoint {
    return {
      blobs: [
        "api-call",
        worker,
        success ? "success" : "failure",
        endpoint,
        ""
      ],
      doubles: [latencyMs, 0, 0],
      indexes: [crypto.randomUUID()]
    };
  },

  workerPerf(data: WorkerPerfData): DataPoint {
    return {
      blobs: [
        "worker-perf",
        data.worker,
        data.errors > 0 ? "degraded" : "success",
        "",
        ""
      ],
      doubles: [data.requests, data.errors, data.duration],
      indexes: [crypto.randomUUID()]
    };
  },

  signal(data: SignalData): DataPoint {
    return {
      blobs: [
        "signal",
        data.source,
        "pending",
        data.type,
        data.symbol
      ],
      doubles: [data.confidence, 0, 0],
      indexes: [crypto.randomUUID()]
    };
  },

  notification(data: NotificationData): DataPoint {
    return {
      blobs: [
        "notification",
        data.target,
        data.success ? "success" : "failure",
        data.type,
        ""
      ],
      doubles: [0, 0, 0],
      indexes: [crypto.randomUUID()]
    };
  }
};
