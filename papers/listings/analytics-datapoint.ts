// Source: workers/analytics-worker/src/index.ts (lines 197-229)
// Listing id: analytics-datapoint
// Caption: Analytics Engine writeDataPoint for trades and API calls
// Service binding methods (called by other workers)
export function writeDataPoint(data: DataPoint, env: Env): void {
  env.ANALYTICS_ENGINE.writeDataPoint({
    blobs: data.blobs,
    doubles: data.doubles,
    indexes: data.indexes,
  });
}

export function trackTrade(
  payload: TradePayload,
  result: TradeResult,
  latencyMs: number,
  env: Env
): void {
  const dataPoint = buildDataPoint.trade(payload, result, latencyMs);
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
}

export async function trackApiCall(
  env: Env,
  body: z.infer<typeof ApiCallBodySchema>
): Promise<void> {
  const dataPoint = buildDataPoint.apiCall(
    body.worker,
    body.endpoint,
    body.latencyMs,
    body.success
  );
  if (body.indexes?.length) {
    dataPoint.indexes = [...dataPoint.indexes, ...body.indexes];
  }
  env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
