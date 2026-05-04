# Analytics Worker Design Specification

**Date:** 2026-05-04  
**Status:** Approved  
**Worker Name:** `analytics-worker`

## Overview

A full-stack Cloudflare Worker that provides analytics capabilities for the hoox trading system. It collects data points from all workers via service bindings and provides querying capabilities through pre-defined methods. Uses Cloudflare Analytics Engine for storage and SQL API for querying.

## Requirements

### Functional Requirements
- Collect analytics data from all workers (trade-worker, agent-worker, telegram-worker, email-worker, web3-wallet-worker, d1-worker, hoox gateway)
- Write data points to Cloudflare Analytics Engine without blocking trade execution
- Provide pre-defined query methods for common analytics needs
- Use service bindings for both data ingestion and querying

### Non-Functional Requirements
- Analytics writes must not increase trade execution time (non-blocking)
- Basic functionality (success criteria: writes work, queries work)
- Follow existing project patterns (trade-worker boilerplate)

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     hoox Ecosystem                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  trade-worker ────┐                                        │
│  agent-worker ─────┤                                        │
│  telegram-worker ──┤  Service Bindings (fire-and-forget)   │
│  email-worker ─────┼──────────► analytics-worker           │
│  web3-wallet ─────┤              │                         │
│  d1-worker ───────┘              │ writeDataPoint()        │
│  hoox (gateway) ──────────────┘  (non-blocking)          │
│                                        │                   │
│                                        ▼                   │
│                            Cloudflare Analytics Engine      │
│                                   (hoox-analytics)         │
│                                        │                   │
│                               Query: HTTP to SQL API       │
│                               (separate from write path)   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Non-blocking writes**: Calling workers use `ctx.waitUntil()` when calling analytics-worker
2. **Service bindings for everything**: Both ingestion and querying use service bindings (no HTTP endpoints needed)
3. **Single dataset**: All data types go to `hoox-analytics` dataset with generic blob/double structure
4. **Pre-defined queries**: Query methods are pre-defined (not generic SQL execution)

## Data Point Structure

Using generic structure with single dataset `hoox-analytics`. Each data point uses:

### Blobs (strings) - dimensions for grouping/filtering:
- `blobs[0]` = dataType (trade, worker-perf, api-call, signal, notification)
- `blobs[1]` = worker name (trade-worker, agent-worker, etc.)
- `blobs[2]` = status (success, failure, pending)
- `blobs[3]` = identifier1 (exchange for trades, endpoint for API calls, etc.)
- `blobs[4]` = identifier2 (symbol for trades, method for API calls, etc.)

### Doubles (numbers) - numeric values:
- `doubles[0]` = value1 (quantity for trades, latency for API calls, etc.)
- `doubles[1]` = value2 (price for trades, error count for worker-perf, etc.)
- `doubles[2]` = value3 (duration, confidence, etc.)

### Indexes (string, single) - sampling key:
- `indexes[0]` = requestId or session identifier

### Example Data Points

```typescript
// Trade execution
env.ANALYTICS_ENGINE.writeDataPoint({
  blobs: ["trade", "trade-worker", "success", "binance", "BTCUSDT"],
  doubles: [0.5, 45000.50, 1200], // quantity, price, latency_ms
  indexes: [requestId]
});

// API call
env.ANALYTICS_ENGINE.writeDataPoint({
  blobs: ["api-call", "trade-worker", "success", "binance", "/api/v3/order"],
  doubles: [250, 0, 0], // latency_ms, 0, 0
  indexes: [requestId]
});

// Worker performance
env.ANALYTICS_ENGINE.writeDataPoint({
  blobs: ["worker-perf", "agent-worker", "success", "cron", "5min"],
  doubles: [1, 0, 15000], // requests, errors, duration_ms
  indexes: [requestId]
});

// Trading signal
env.ANALYTICS_ENGINE.writeDataPoint({
  blobs: ["signal", "agent-worker", "pending", "binance", "BTCUSDT"],
  doubles: [0.85, 0, 0], // confidence, 0, 0
  indexes: [requestId]
});

// Notification
env.ANALYTICS_ENGINE.writeDataPoint({
  blobs: ["notification", "telegram-worker", "success", "trade-alert", "telegram"],
  doubles: [0, 0, 0], // not used
  indexes: [requestId]
});
```

## Service Binding Interface

### Write Methods (called by other workers)

```typescript
interface AnalyticsService {
  // Generic write - flexible for all data types
  writeDataPoint(data: {
    blobs: string[];
    doubles: number[];
    indexes: string[];
  }): Promise<void>;
  
  // Helper methods for specific data types (optional convenience)
  trackTrade(payload: TradePayload, result: TradeResult, latency: number): Promise<void>;
  trackApiCall(worker: string, endpoint: string, latency: number, success: boolean): Promise<void>;
  trackWorkerPerf(worker: string, requests: number, errors: number, duration: number): Promise<void>;
  trackSignal(source: string, type: string, symbol: string, confidence: number): Promise<void>;
  trackNotification(type: string, target: string, success: boolean): Promise<void>;
}
```

### Query Methods (pre-defined, makes HTTP to Cloudflare SQL API)

```typescript
interface AnalyticsQueryService {
  // Trade metrics
  getTradeMetrics(timeRange: { start: string; end: string }): Promise<TradeMetrics>;
  getTradesByExchange(exchange: string, limit?: number): Promise<TradeData[]>;
  getTradeSuccessRate(timeRange?: string): Promise<number>;
  
  // Worker performance
  getWorkerPerformance(worker: string, timeRange?: string): Promise<WorkerPerf>;
  getApiCallStats(exchange?: string): Promise<ApiCallStats>;
  
  // Signals
  getSignalOutcomes(timeRange?: string): Promise<SignalOutcome[]>;
}
```

### Usage Example in trade-worker

```typescript
// In fetch handler, after trade execution:
ctx.waitUntil(
  env.ANALYTICS_SERVICE.trackTrade(payload, result, Date.now() - startTime)
);
// Return trade response immediately - analytics doesn't block
```

## Worker File Structure

Following the existing boilerplate pattern (like `trade-worker`):

```
workers/analytics-worker/
├── package.json          # Dependencies, scripts (same pattern as trade-worker)
├── wrangler.jsonc       # Cloudflare config with analytics_engine binding
├── tsconfig.json        # TypeScript config (inherit from project)
├── src/
│   ├── index.ts         # Main worker (fetch + service binding methods)
│   ├── types.ts        # Env interface, data point types
│   ├── query-builder.ts # Pre-defined SQL query methods
│   └── helpers.ts      # Data point construction helpers
├── test/
│   └── index.test.ts   # Basic tests (write + query mocking)
└── README.md           # Documentation (basic)
```

### Key Configuration

**wrangler.jsonc:**
```jsonc
{
  "name": "analytics-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  "analytics_engine_datasets": [
    {
      "binding": "ANALYTICS_ENGINE",
      "dataset": "hoox-analytics"
    }
  ],
  "vars": {
    "CF_ACCOUNT_ID": "debc6545e63bea36be059cbc82d80ec8"
  },
  "services": []  // No downstream services needed
}
```

**src/types.ts:**
```typescript
export interface Env {
  ANALYTICS_ENGINE: AnalyticsEngineDataset;
  CF_API_TOKEN?: string;  // Secret for SQL API queries
  CF_ACCOUNT_ID?: string; // From vars
}
```

## Implementation Details

### Service Binding Methods in Worker

```typescript
// src/index.ts - Service binding handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // HTTP endpoints (if needed later for dashboard)
    return new Response("Analytics Worker - use service bindings", { status: 200 });
  },

  // Service binding calls come through `call` or direct method invocation
  async writeDataPoint(data: DataPoint, env: Env): Promise<void> {
    env.ANALYTICS_ENGINE.writeDataPoint({
      blobs: data.blobs,
      doubles: data.doubles,
      indexes: data.indexes
    });
  },

  async trackTrade(payload: any, result: any, latency: number, env: Env): Promise<void> {
    const dataPoint = {
      blobs: ["trade", "trade-worker", result.success ? "success" : "failure", 
              payload.exchange, payload.symbol],
      doubles: [payload.quantity, payload.price || 0, latency],
      indexes: [payload.requestId || crypto.randomUUID()]
    };
    env.ANALYTICS_ENGINE.writeDataPoint(dataPoint);
  },

  async getTradeMetrics(timeRange: any, env: Env): Promise<any> {
    const sql = `SELECT blob3 as exchange, COUNT(*) as count, 
                  SUM(_sample_interval * double2) / SUM(_sample_interval) as avg_price
                 FROM hoox-analytics 
                 WHERE blob1 = 'trade' 
                   AND timestamp >= '${timeRange.start}' 
                   AND timestamp <= '${timeRange.end}'
                 GROUP BY blob3`;
    
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
    return await response.json();
  }
}
```

### Key Implementation Points

1. **`writeDataPoint()` is synchronous but non-blocking** (Cloudflare runtime handles it)
2. **Query methods make HTTP calls** to Cloudflare SQL API with stored token
3. **Service binding methods receive `env` implicitly** (Cloudflare pattern)
4. **Secrets needed**: `CF_API_TOKEN` for SQL API queries

## Integration with Existing Workers

### workers.jsonc Configuration

Add to `workers.jsonc`:
```jsonc
"analytics-worker": {
  "enabled": true,
  "path": "workers/analytics-worker",
  "vars": {},
  "secrets": ["CF_API_TOKEN"]
}
```

### Service Binding in Other Workers

Each worker's `wrangler.jsonc` gets:
```jsonc
"services": [
  {
    "binding": "ANALYTICS_SERVICE",
    "service": "analytics-worker"
  }
]
```

### Non-Blocking Call Pattern

In trade-worker (and others):
```typescript
// After trade execution, before returning response:
ctx.waitUntil(
  env.ANALYTICS_SERVICE.trackTrade(payload, result, Date.now() - startTime)
);
// Response returns immediately
```

## Success Criteria

✅ Successfully receives data via service bindings  
✅ Writes to Analytics Engine without blocking  
✅ Returns query results via pre-defined methods  
✅ Basic functionality working (write + query)  

## Out of Scope (for this iteration)

- Error handling for failed writes (retry logic)
- Validation of incoming data
- Health check endpoint
- Monitoring/alerting integration
- Rate limiting
- Full test coverage
- Documentation beyond README

## Next Steps

After design approval:
1. Write implementation plan using writing-plans skill
2. Clone boilerplate from trade-worker
3. Implement worker following design
4. Integrate with one worker first (trade-worker)
5. Test basic write + query functionality
