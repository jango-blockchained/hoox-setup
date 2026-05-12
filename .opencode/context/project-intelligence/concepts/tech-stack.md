<!-- Context: project-intelligence/concepts | Priority: critical | Version: 2.0 | Updated: 2026-05-12 -->

# Tech Stack

**Concept**: Bun monorepo with 9 Cloudflare Workers, D1, Smart Placement, Vectorize, Browser Rendering, and Next.js 16 dashboard (Cloudflare Workers + OpenNext).

## Key Points

- **Runtime**: Bun (never npm/yarn), strict TypeScript, Edge-compatible (no Node built-ins)
- **Workers**: 9 Cloudflare Workers with Service Bindings, Smart Placement, wrangler.jsonc per worker
- **Storage**: D1 (SQLite edge), R2 (reports/logs), KV (config + rate limiter state), Durable Objects (idempotency)
- **AI**: Workers AI (LLaMA 3), Vectorize (RAG index), AI Gateway (multi-provider fallback)
- **Dashboard**: Next.js 16 + Turbopack + @opennextjs/cloudflare adapter
- **Testing**: bun test (unit), vitest + @cloudflare/vitest-pool-workers (integration)

## Versions

| Tool               | Version           |
| ------------------ | ----------------- |
| Bun                | ≥1.2              |
| TypeScript         | Strict mode       |
| Next.js            | 16                |
| Cloudflare Workers | 2025-03-07 compat |

## 📂 Codebase References

**Monorepo**: `package.json` (workspaces: packages/_, workers/_, pages/*)
**Dashboard**: `pages/dashboard/next.config.ts`
**CLI**: `packages/cli/`
