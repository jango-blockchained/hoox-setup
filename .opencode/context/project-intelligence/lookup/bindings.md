<!-- Context: project-intelligence/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-03 -->

# Bindings Reference

**Concept**: Cloudflare bindings connect workers to storage, queues, and each other.

## Binding Types

| Type            | Binding Prefix    | Example             |
| --------------- | ----------------- | ------------------- |
| Service Binding | `*_SERVICE`       | `TRADE_SERVICE`     |
| KV Namespace    | `*_KV`            | `CONFIG_KV`         |
| Queue           | `*_QUEUE`         | `TRADE_QUEUE`       |
| Durable Object  | `*_STORE`         | `IDEMPOTENCY_STORE` |
| R2 Bucket       | `*_BUCKET`        | `REPORTS_BUCKET`    |
| D1 Database     | `*` (in wrangler) | `DB`                |

## Common Patterns

```jsonc
// Service Binding - call another worker
"services": [{ "binding": "TRADE_SERVICE", "service": "trade-worker" }]

// KV - config/feature flags
"kv_namespaces": [{ "binding": "CONFIG_KV", "id": "<id>" }]

// Queue - async processing
"queues": { "producers": [{ "queue": "trade-execution", "binding": "TRADE_QUEUE" }] }
```

## Feature Matrix

| Feature         | hoox | trade | telegram | agent | d1  |
| --------------- | ---- | ----- | -------- | ----- | --- |
| Service Binding | -    | ✅    | ✅       | ✅    | -   |
| D1 Storage      | -    | ✅    | -        | ✅    | -   |
| KV Storage      | ✅   | ✅    | ✅       | ✅    | ✅  |

## 📂 Codebase References

**Central config**: `workers.jsonc` - `secrets` and `bindings` per worker
**Example**: `workers/hoox/wrangler.jsonc:35-70`
