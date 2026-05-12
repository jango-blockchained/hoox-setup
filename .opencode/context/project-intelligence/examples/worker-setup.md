<!-- Context: project-intelligence/examples | Priority: high | Version: 2.0 | Updated: 2026-05-12 -->

# Worker Setup Example

**Concept**: Each worker has `wrangler.jsonc` (gitignored — use `.example` template), `.dev.vars`, Smart Placement, observability, and service bindings.

## wrangler.jsonc Template

```jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  "placement": { "mode": "smart" },
  "observability": { "enabled": true, "head_sampling_rate": 1 },
  "kv_namespaces": [{ "binding": "CONFIG_KV", "id": "<id>" }],
  "services": [{ "binding": "TARGET_SERVICE", "service": "target-worker" }],
  "ai": { "binding": "AI" },
  "dev": { "runtime": "native" }
}
```

## Key Bindings

| Binding             | Type            | Purpose                 |
| ------------------- | --------------- | ----------------------- |
| `*_SERVICE`         | Service Binding | Call another worker     |
| `CONFIG_KV`         | KV              | Config + rate limiter   |
| `TRADE_QUEUE`       | Queue           | Async job processing    |
| `IDEMPOTENCY_STORE` | Durable Object  | Prevent duplicates      |
| `AI`                | Workers AI      | LLaMA inference         |
| `VECTORIZE_INDEX`   | Vectorize       | RAG-powered AI          |

## New Worker Checklist

1. Create `workers/<name>/` directory (or add as submodule)
2. Create `wrangler.jsonc` + `wrangler.jsonc.example` with bindings
3. Enable Smart Placement + observability in config
4. Add service bindings for internal worker communication
5. Create `src/index.ts` with `createRouter<Env>()` pattern
6. Add `.dev.vars` for local secrets
7. Register secrets via `wrangler secret put`
8. Deploy: `wrangler deploy`

## 📂 Codebase References

**Examples**: `workers/*/wrangler.jsonc.example`
**Templates**: `workers/*/package.json`, `workers/*/tsconfig.json`
