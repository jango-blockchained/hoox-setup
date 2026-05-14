<!-- Context: project-intelligence/lookup | Priority: medium | Version: 3.1 | Updated: 2026-05-14 -->

# Bindings Reference

**Concept**: Cloudflare bindings connect workers to storage, queues, AI, and each other. 10 workers across the platform.

## Binding Types

| Type            | Binding Prefix    | Example                 | Used By (all 10 workers)            |
| --------------- | ----------------- | ----------------------- | ----------------------------------- |
| Service Binding | `*_SERVICE`       | `TRADE_SERVICE`         | hoox, trade, agent, telegram, d1, web3, email, report, dashboard |
| KV Namespace    | `*_KV`            | `CONFIG_KV`             | hoox, trade, agent, telegram, d1, email, dashboard |
| R2 Bucket       | `*_BUCKET`        | `REPORTS_BUCKET`        | trade, telegram, report             |
| Queue           | `*_QUEUE`         | `TRADE_QUEUE`           | hoox (producer), trade (consumer)   |
| Durable Object  | `*_STORE`         | `IDEMPOTENCY_STORE`     | hoox                                |
| D1 Database     | `DB`              | `DB`                    | trade, agent, d1                    |
| Workers AI      | `AI`              | `AI`                    | hoox, agent, telegram               |
| Vectorize       | `*_INDEX`         | `VECTORIZE_INDEX`       | hoox, telegram                      |
| Analytics Engine| `ANALYTICS_ENGINE`| `ANALYTICS_ENGINE`      | analytics-worker                    |
| Browser         | `BROWSER`         | (REST API)              | report-worker (via CF API)          |

## Service Binding Mesh

| Worker             | Calls (Service Bindings)                                  | Called By                                   |
| ------------------ | --------------------------------------------------------- | ------------------------------------------- |
| hoox               | `ANALYTICS_SERVICE`, `TRADE_SERVICE`, `TELEGRAM_SERVICE`  | — (public gateway)                          |
| trade-worker       | `D1_SERVICE`, `TELEGRAM_SERVICE`, `ANALYTICS_SERVICE`     | hoox, agent-worker, email-worker            |
| agent-worker       | `D1_SERVICE`, `TRADE_SERVICE`, `TELEGRAM_SERVICE`         | dashboard                                   |
| telegram-worker    | `ANALYTICS_SERVICE`                                       | hoox, trade, agent, web3, report            |
| d1-worker          | `ANALYTICS_SERVICE`                                       | trade, agent, dashboard                     |
| web3-wallet-worker | `TELEGRAM_SERVICE`, `ANALYTICS_SERVICE`                   | — (manual/API triggered)                    |
| email-worker       | `TRADE_SERVICE`, `ANALYTICS_SERVICE`                      | — (cron/email triggered)                    |
| analytics-worker   | (none — pure Analytics Engine)                            | hoox, trade, telegram, d1, web3, email      |
| report-worker      | `D1_SERVICE`, `TELEGRAM_SERVICE`                          | — (cron triggered)                          |
| dashboard          | `D1_SERVICE`, `AGENT_SERVICE`                             | — (public UI via OpenNext)                  |

## Common Patterns

```jsonc
// Service Binding - call another worker
"services": [{ "binding": "TRADE_SERVICE", "service": "trade-worker" }]

// KV - config/feature flags + rate limiter state
"kv_namespaces": [{ "binding": "CONFIG_KV", "id": "<id>" }]

// Queue - async processing
"queues": { "producers": [{ "queue": "trade-execution", "binding": "TRADE_QUEUE" }] }

// Durable Object - idempotency
"durable_objects": { "bindings": [{ "name": "IDEMPOTENCY_STORE", "class_name": "IdempotencyStore" }] }

// Workers AI - LLaMA inference
"ai": { "binding": "AI" }

// Vectorize - RAG index
"vectorize": [{ "binding": "VECTORIZE_INDEX", "index_name": "my-rag-index" }]

// Analytics Engine - time-series
"analytics_engine_datasets": [{ "binding": "ANALYTICS_ENGINE", "dataset": "hoox-analytics" }]

// Browser Rendering (REST API, no binding needed)
// POST https://api.cloudflare.com/client/v4/accounts/{id}/browser-rendering/pdf
```

## Feature Matrix

| Feature         | hoox | trade | telegram | agent | d1 | web3 | email | analytics | report | dashboard |
| --------------- | ---- | ----- | -------- | ----- | -- | ---- | ----- | --------- | ------ | --------- |
| Service Binding | ✅   | ✅    | ✅       | ✅    | ✅ | ✅   | ✅    | —         | ✅     | ✅        |
| D1 Storage      | —    | ✅    | —        | ✅    | ✅ | —    | —     | —         | ✅     | —         |
| R2 Storage      | —    | ✅    | ✅       | —     | —  | —    | —     | —         | ✅     | —         |
| KV Storage      | ✅   | ✅    | ✅       | ✅    | ✅ | —    | ✅    | —         | —      | ✅        |
| Queue           | ✅ P | ✅ C  | —        | —     | —  | —    | —     | —         | —      | —         |
| Durable Object  | ✅   | —     | —        | —     | —  | —    | —     | —         | —      | —         |
| Workers AI      | ✅   | —     | ✅       | ✅    | —  | —    | —     | —         | —      | —         |
| Vectorize       | ✅   | —     | ✅       | —     | —  | —    | —     | —         | —      | —         |
| Analytics Engine| —    | —     | —        | —     | —  | —    | —     | ✅        | —      | —         |
| Smart Placement | ✅   | ✅    | ✅       | ✅    | ✅ | ✅   | ✅    | ✅        | ✅     | —         |
| Observability   | ✅   | ✅    | ✅       | ✅    | ✅ | ✅   | ✅    | ✅        | ✅     | ✅        |

## 📂 Codebase References

**Configs**: `workers/*/wrangler.jsonc` per worker (10 workers)
**Browser Rendering REST API**: `workers/report-worker/src/index.ts`
**Analytics Engine**: `workers/analytics-worker/src/index.ts`
**Dashboard bindings**: `workers/dashboard/wrangler.jsonc` (D1_SERVICE, AGENT_SERVICE)
