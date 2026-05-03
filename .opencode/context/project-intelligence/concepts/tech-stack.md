<!-- Context: project-intelligence/concepts | Priority: critical | Version: 1.0 | Updated: 2026-05-03 -->

# Tech Stack

**Concept**: Bun monorepo with Cloudflare Workers, D1, and Next.js 16 dashboard.

## Key Points
- **Runtime**: Bun (never npm/yarn), strict TypeScript, Edge-compatible (no Node built-ins)
- **Workers**: Cloudflare Workers with Service Bindings, wrangler.jsonc per worker
- **Database**: D1 (SQLite edge), Drizzle ORM via d1-worker
- **Dashboard**: Next.js 16 + Turbopack + @opennextjs/cloudflare adapter
- **Testing**: bun test (unit), vitest + @cloudflare/vitest-pool-workers (integration)

## Versions
| Tool | Version |
|------|---------|
| Bun | ≥1.2 |
| TypeScript | Strict mode |
| Next.js | 16 |
| Cloudflare Workers | 2025-03-07 compat |

## 📂 Codebase References
**Monorepo**: `package.json` (workspaces: packages/*, workers/*, pages/*)
**Dashboard**: `pages/dashboard/next.config.ts`
**CLI**: `packages/hoox-cli/`
