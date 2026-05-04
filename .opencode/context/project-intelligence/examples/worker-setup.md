<!-- Context: project-intelligence/examples | Priority: high | Version: 1.0 | Updated: 2026-05-03 -->

# Worker Setup Example

**Concept**: Each worker has `wrangler.jsonc`, `.dev.vars`, and service bindings for inter-worker communication.

## wrangler.jsonc Template

```jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  "secrets": ["INTERNAL_KEY"],
  "kv_namespaces": [{ "binding": "CONFIG_KV", "id": "<id>" }],
  "services": [{ "binding": "TARGET_SERVICE", "service": "target-worker" }],
  "queues": { "producers": [{ "queue": "my-queue", "binding": "Q" }] },
  "durable_objects": {
    "bindings": [{ "name": "STORE", "class_name": "Store" }],
  },
}
```

## .dev.vars (local)

```
INTERNAL_KEY=shared_secret_here
WEBHOOK_API_KEY_BINDING=external_key_here
```

## Key Bindings

| Binding             | Type            | Purpose              |
| ------------------- | --------------- | -------------------- |
| `*_SERVICE`         | Service Binding | Call another worker  |
| `CONFIG_KV`         | KV              | Config/feature flags |
| `TRADE_QUEUE`       | Queue           | Async job processing |
| `IDEMPOTENCY_STORE` | Durable Object  | Prevent duplicates   |

## 📂 Codebase References

**Example**: `workers/hoox/wrangler.jsonc`
**Central config**: `workers.jsonc`
