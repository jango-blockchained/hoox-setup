// workers/analytics-worker/src/query-builder.ts

export const buildQuery = {
  getTradeMetrics(timeRange: { start: string; end: string }): string {
    return `
      SELECT 
        blob3 as exchange, 
        COUNT(*) as trade_count,
        SUM(_sample_interval * double2) / SUM(_sample_interval) as avg_price,
        SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN blob2 = 'failure' THEN 1 ELSE 0 END) as failure_count
      FROM hoox-analytics 
      WHERE blob1 = 'trade' 
        AND timestamp >= '${timeRange.start}' 
        AND timestamp <= '${timeRange.end}'
      GROUP BY blob3
    `.trim();
  },

  getTradesByExchange(exchange: string, limit: number = 100): string {
    return `
      SELECT 
        timestamp,
        blob4 as symbol,
        blob2 as action,
        double1 as quantity,
        double2 as price
      FROM hoox-analytics 
      WHERE blob1 = 'trade' 
        AND blob3 = '${exchange}'
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `.trim();
  },

  getTradeSuccessRate(timeRange?: string): string {
    const timeFilter = timeRange 
      ? `AND timestamp >= '${timeRange}'` 
      : '';
    
    return `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as successes,
        (SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
      FROM hoox-analytics 
      WHERE blob1 = 'trade' 
      ${timeFilter}
    `.trim();
  },

  getWorkerPerformance(worker: string, timeRange?: string): string {
    const timeFilter = timeRange 
      ? `AND timestamp >= '${timeRange}'` 
      : '';
    
    return `
      SELECT 
        blob1 as data_type,
        SUM(double1) as total_requests,
        SUM(double2) as total_errors,
        AVG(double3) as avg_duration_ms
      FROM hoox-analytics 
      WHERE blob1 IN ('worker-perf', 'api-call')
        AND blob2 = '${worker}'
        ${timeFilter}
      GROUP BY blob1
    `.trim();
  },

  getApiCallStats(exchange?: string): string {
    const exchangeFilter = exchange 
      ? `AND blob3 = '${exchange}'` 
      : '';
    
    return `
      SELECT 
        blob3 as endpoint,
        COUNT(*) as call_count,
        AVG(double1) as avg_latency_ms,
        SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as success_count
      FROM hoox-analytics 
      WHERE blob1 = 'api-call'
      ${exchangeFilter}
      GROUP BY blob3
      ORDER BY call_count DESC
    `.trim();
  },

  getSignalOutcomes(timeRange?: string): string {
    const timeFilter = timeRange 
      ? `AND timestamp >= '${timeRange}'` 
      : '';
    
    return `
      SELECT 
        blob2 as source,
        blob3 as signal_type,
        blob4 as symbol,
        COUNT(*) as signal_count,
        AVG(double1) as avg_confidence
      FROM hoox-analytics 
      WHERE blob1 = 'signal'
      ${timeFilter}
      GROUP BY blob2, blob3, blob4
      ORDER BY signal_count DESC
    `.trim();
  }
};
