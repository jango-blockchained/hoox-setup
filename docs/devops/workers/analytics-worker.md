---
title: "📊 analytics-worker"
description: "Time-series analytics collection for the entire hoox platform"
---
# 📊 analytics-worker

> Time-series analytics collection for the entire hoox platform

## Overview

`analytics-worker` collects and stores observability data from all other workers via service bindings. It exposes a REST API for writing data points and querying Analytics Engine datasets.

## Features

- **Unified Analytics Endpoint**: All workers send metrics via a single `ANALYTICS_SERVICE` service binding
- **Real-Time Tracking**: API call latency, error rates, and success/failure per endpoint per worker
- **No-Imports Required**: Workers call via `env.ANALYTICS_SERVICE.fetch()` — no SDK needed
- **Cross-Worker Visibility**: Dashboard queries analytics across hoox, trade-worker, telegram-worker, and more

## Usage

```typescript
// From any worker with ANALYTICS_SERVICE binding:
await env.ANALYTICS_SERVICE.fetch("http://localhost/track/api-call", {
  method: "POST",
  body: JSON.stringify({
    worker: "hoox",
    endpoint: "/webhook",
    latencyMs: 142,
    success: true,
  }),
});
```

## Workers Using Analytics

| Worker | Binding | Tracked Events |
|--------|---------|---------------|
| hoox | `ANALYTICS_SERVICE` | API calls, trade requests |
| trade-worker | `ANALYTICS_SERVICE` | Trade executions, exchange responses |
| telegram-worker | `ANALYTICS_SERVICE` | Message processing, AI queries |

## 📂 Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Analytics endpoint handler |

## Related

- [Monitoring Guide](../deployment/monitoring.md)
- [Bindings Reference](../architecture/bindings.md)
