# 📊 Monitoring

> Keeping an eye on system health and performance across all 9 workers

## Observability Config

Every worker has `observability` enabled in `wrangler.jsonc`:

```jsonc
{
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1  // 100% request sampling
  }
}
```

Workers with observability: hoox, trade-worker, agent-worker, telegram-worker, d1-worker, analytics-worker, report-worker.

## Analytics Engine

The `analytics-worker` collects time-series data from all workers via `ANALYTICS_SERVICE` bindings:

| Worker | Events Tracked |
|--------|---------------|
| hoox | API call latency, error rates, success/failure |
| trade-worker | Trade execution metrics, exchange response times |
| telegram-worker | Message processing, AI query latency |

Data is written to an Analytics Engine dataset and queryable via SQL:

```sql
SELECT blob, double1, timestamp FROM hoox_analytics WHERE timestamp > now() - INTERVAL '1' DAY
```

## Cloudflare Dashboard

The Cloudflare Dashboard provides per-worker metrics:

1. Go to **Workers & Pages**
2. Select a worker
3. **Metrics** tab shows: Requests, Errors, CPU Time, Subrequests, Uncaught Exceptions

## Custom Monitoring via Telegram

Failed trades or critical errors trigger Telegram notifications automatically:

```typescript
if (!response.ok) {
  await env.TELEGRAM_SERVICE.fetch("http://telegram-service/process", {
    method: "POST",
    body: JSON.stringify({
      message: `🚨 Trade Execution Error: ${response.statusText}`,
    }),
  });
}
```

## Health Endpoints

All workers expose a standardized `/health` endpoint:

```bash
curl https://hoox.cryptolinx.workers.dev/health
# → { "status": "ok", "worker": "hoox", "uptime": 12345 }
```

## Next Steps

- [Debugging](../development/debugging.md)
- [Architecture Overview](../architecture/overview.md)
