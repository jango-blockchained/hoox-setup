---
title: "analytics-worker Isolate Profile"
description: "Comprehensive engineering specification for the Hoox Analytics Observability Worker, covering Analytics Engine datasets, latency metrics, and dashboard API queries."
---

# 📊 analytics-worker Isolate Profile

The **`analytics-worker`** is the observability engine of the Hoox trading platform. Deployed as a private internal microservice, it aggregates time-series metrics, database query latencies, execution performance ratios, and API status codes across all V8 isolates. By translating incoming events and writing them to **Cloudflare Analytics Engine**, it provides the backend telemetry used to draw live charts in the Next.js Dashboard.

---

## ⚡ 1. Declared Wrangler Configurations & Bindings

The `analytics-worker` binds directly to Cloudflare’s **Analytics Engine** dataset and does not expose any public endpoints:

```jsonc
{
  "name": "analytics-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-19",
  "compatibility_flags": ["nodejs_compat"],
  "account_id": "debc6545e63bea36be059cbc82d80ec8",
  "analytics_engine_datasets": [
    {
      "binding": "ANALYTICS_ENGINE",
      "dataset": "hoox_telemetry",
    },
  ],
  "kv_namespaces": [
    {
      "binding": "CONFIG_KV",
      "id": "c5917667a21745e390ff969f32b1847d",
    },
  ],
  "secrets": [
    "INTERNAL_KEY_BINDING",
    "CLOUDFLARE_API_TOKEN", // Required to run SQL queries against Analytics datasets
  ],
}
```

---

## 🔑 2. Environmental Variables & Encrypted Secrets

- **`CLOUDFLARE_API_TOKEN`**: A secure token with `Account.Analytics` read permissions, allowing the worker to query stored datasets.
- **`INTERNAL_KEY_BINDING`**: Shared key used to validate calls from other V8 isolates.

---

## 🔌 3. Internal REST API Specification

Every endpoint is secured via `requireInternalAuth` and expects the `X-Internal-Auth-Key` header.

### A. Track Telemetry Event

Invoked by other workers (like `hoox` or `trade-worker`) immediately upon completing an action.

- **Endpoint**: `/track/api-call`
- **Method**: `POST`
- **JSON Payload**:
  ```json
  {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "payload": {
      "worker": "trade-worker",
      "endpoint": "/webhook",
      "latencyMs": 24.5,
      "success": true
    }
  }
  ```

#### Under-the-Hood Analytics Engine Write

When received, the worker formats and writes a time-series data point using standard **Blobs** (metadata strings) and **Doubles** (numeric values):

```typescript
env.ANALYTICS_ENGINE.writeDataPoint({
  blobs: [
    payload.worker, // Blob 1: Worker Name
    payload.endpoint, // Blob 2: Endpoint Path
    payload.success ? "1" : "0", // Blob 3: Success state
  ],
  doubles: [
    payload.latencyMs, // Double 1: Latency in milliseconds
  ],
  indexes: [
    payload.requestId, // Custom index for distributed tracing
  ],
});
```

- **Response (200 OK)**:
  ```json
  { "success": true }
  ```

---

### B. Query Metrics (SQL interface)

Used primarily by the Next.js Dashboard to extract data points for chart rendering.

- **Endpoint**: `/query`
- **Method**: `POST`
- **JSON Payload**:
  ```json
  {
    "query": "SELECT sum(double1) as total_latency, count() as total_calls FROM hoox_telemetry WHERE blob1 = ? AND timestamp >= now() - INTERVAL '1' DAY",
    "params": ["trade-worker"]
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "results": [{ "total_latency": 10482.5, "total_calls": 428 }]
  }
  ```

---

## 📈 4. Dashboard Visual Integrations

The metrics written to `hoox_telemetry` are queried by the dashboard to render:

1. **System Health Indicators**: Real-time error spikes trigger warning banners in under 2 seconds.
2. **Isolate Latency Charts**: Visual line graphs showing V8 processing speeds vs exchange API transit speeds.
3. **Volume Load Heatmaps**: Visualizes peak trading hours and signal traffic volumes globally.

---

> **Tip:** Testing analytics locally? Local Wrangler dev automatically intercepts `writeDataPoint` calls and logs the parsed Blobs and Doubles straight to your terminal standard output, ensuring easy debugging!

### 🔗 Next Steps

- **[System Observability Guides](../deployment/monitoring.md)** — Deepen your understanding of time-series logging and metrics.
- **[trade-worker Profile](trade-worker.md)** — Review how execution latency details are generated and offloaded.
