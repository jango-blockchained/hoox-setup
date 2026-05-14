<!-- Context: project-intelligence/concepts | Priority: critical | Version: 3.0 | Updated: 2026-05-14 -->

# Tech Stack

**Concept**: Bun monorepo with 10 Cloudflare Workers, D1, Smart Placement, Vectorize, Browser Rendering, Next.js 16 dashboard (Cloudflare Workers + OpenNext), and Zod schema validation across the stack.

## Key Points

- **Runtime**: Bun (never npm/yarn), strict TypeScript, Edge-compatible (no Node built-ins)
- **Workers**: 10 Cloudflare Workers with Service Bindings, Smart Placement, wrangler.jsonc per worker
- **Storage**: D1 (SQLite edge), R2 (reports/logs), KV (config + rate limiter state), Durable Objects (idempotency)
- **AI**: Workers AI (LLaMA 3), Vectorize (RAG index), AI Gateway (multi-provider fallback)
- **Dashboard**: Next.js 16 + Turbopack + @opennextjs/cloudflare adapter (at `workers/dashboard/`)
- **Testing**: bun test (unit), vitest + @cloudflare/vitest-pool-workers (integration)
- **Validation**: Zod (schema validation across workers and shared package)
- **Docs site**: Astro 6 (pages/docs/, deployed to GitHub Pages)
- **Context**: `.opencode/` — centralized project knowledge hub with plans, specs, skills, context files, tasks

## Versions

| Tool               | Version             |
| ------------------ | ------------------- |
| Bun                | ≥1.2                |
| TypeScript         | Strict mode         |
| Next.js            | 16                  |
| Cloudflare Workers | 2025-03-07 compat   |
| Wrangler           | 4.83 (types gen)    |
| Astro              | 6 (docs site)       |
| Zod                | ≥4 (shared package) |
| CLI                | 0.3.4               |

## 📂 Codebase References

**Monorepo**: `package.json` (workspaces: packages/_, workers/_, pages/*)
**Dashboard**: `workers/dashboard/next.config.ts` (moved from legacy `pages/dashboard/`)
**CLI**: `packages/cli/`
**Shared validation**: `packages/shared/src/types/` (Zod schemas)
**Docs site**: `pages/docs/astro.config.ts`
**Central context hub**: `.opencode/` (plans/, specs/, skills/, context/, tasks/, sessions/, external-context/)
