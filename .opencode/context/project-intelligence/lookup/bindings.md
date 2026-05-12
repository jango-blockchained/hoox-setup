<!-- Context: project-intelligence/lookup | Priority: medium | Version: 2.0 | Updated: 2026-05-12 -->

# Bindings Reference

**Concept**: Cloudflare bindings connect workers to storage, queues, AI, and each other.

## Binding Types

| Type            | Binding Prefix    | Example                 | Used By                          |
| --------------- | ----------------- | ----------------------- | -------------------------------- |
| Service Binding | `*_SERVICE`       | `TRADE_SERVICE`         | hoox, trade, agent, telegram, report |
| KV Namespace    | `*_KV`            | `CONFIG_KV`             | hoox, trade, agent, telegram, d1, dashboard, email |
| Queue           | `*_QUEUE`         | `TRADE_QUEUE`           | hoox (producer), trade (consumer)  |
| Durable Object  | `*_STORE`         | `IDEMPOTENCY_STORE`     | hoox                              |
| R2 Bucket       | `*_BUCKET`        | `REPORTS_BUCKET`        | trade, telegram, report           |
| D1 Database     | `DB`              | `DB`                    | trade, agent, d1                  |
| Workers AI      | `AI`              | `AI`                    | hoox, agent, telegram             |
| Vectorize       | `*_INDEX`         | `VECTORIZE_INDEX`       | hoox, telegram, trade             |
| Browser         | `BROWSER`         | (REST API)              | report-worker (via CF API)        |

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

// Browser Rendering (REST API, no binding needed)
// POST https://api.cloudflare.com/client/v4/accounts/{id}/browser-rendering/pdf
```

## Feature Matrix

| Feature         | hoox | trade | telegram | agent | d1 | web3 | email | analytics | report |
| --------------- | ---- | ----- | -------- | ----- | -- | ---- | ----- | --------- | ------ |
| Service Binding | —    | ✅    | ✅       | ✅    | —  | —    | ✅    | —         | ✅     |
| D1 Storage      | —    | ✅    | —        | ✅    | ✅ | —    | —     | —         | —      |
| R2 Storage      | —    | ✅    | ✅       | —     | —  | ✅   | —     | —         | ✅     |
| KV Storage      | ✅   | ✅    | ✅       | ✅    | ✅ | —    | ✅    | —         | —      |
| Queue           | ✅ P | ✅ C  | —        | —     | —  | —    | —     | —         | —      |
| Durable Object  | ✅   | —     | —        | —     | —  | —    | —     | —         | —      |
| Workers AI      | ✅   | —     | ✅       | ✅    | —  | —    | —     | —         | —      |
| Vectorize       | ✅   | —     | ✅       | —     | —  | —    | —     | —         | —      |
| Smart Placement | ✅   | ✅    | ✅       | ✅    | ✅ | —    | —     | —         | ✅     |
| Observability   | ✅   | ✅    | ✅       | ✅    | ✅ | —    | —     | ✅        | ✅     |

## 📂 Codebase References

**Configs**: `workers/*/wrangler.jsonc` per worker
**Browser Rendering REST API**: `workers/report-worker/src/index.ts`
