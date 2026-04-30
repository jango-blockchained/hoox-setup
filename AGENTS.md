# Agent Instructions

## Project Structure

Monorepo using Bun workspaces: `packages/*`, `workers/*`, `pages/*`.

| Workspace | Purpose |
|-----------|---------|
| `packages/hoox-cli` | CLI tool (`hoox` commands) |
| `packages/shared` | Shared types and utilities |
| `workers/hoox` | Gateway (webhook entrypoint) |
| `workers/trade-worker` | Multi-exchange execution |
| `workers/agent-worker` | AI risk manager (5min cron) |
| `workers/d1-worker` | D1 database operations |
| `workers/telegram-worker` | Notifications |
| `workers/web3-wallet-worker` | DeFi/on-chain execution |
| `workers/email-worker` | Email signal parsing |
| `pages/dashboard` | Next.js 16 dashboard (Cloudflare Pages) |

## Commands

```bash
bun install              # install dependencies (never npm/yarn)
bun test                # run all tests (bun native runner)
bun test <path>         # run specific test file
bun run lint            # ESLint check
bun run typecheck       # TypeScript check (tsc --noEmit)
bun run build           # TypeScript build check
./hoox-tui              # launch TUI for local dev (all workers)
hoox workers deploy     # deploy all workers to Cloudflare
```

## CI Pipeline Order

`bun run lint` → `bun run typecheck` → `bun test packages/hoox-cli --coverage` → `bun run build`

## Testing

- **Unit tests**: `bun test` (built-in runner), config in `bunfig.toml` (5s timeout, NODE_ENV=test)
- **Integration tests**: vitest + `@cloudflare/vitest-pool-workers`, config in `vitest.config.ts`
- Coverage threshold: 80% (Codecov in CI)
- Run single test: `bun test path/to/test.test.ts`

## Dashboard (pages/dashboard)

- Next.js 16 with Turbopack: `next.config.ts` hardcodes `turbopack.root` to absolute monorepo path
- Next.js 16 uses `proxy.ts` not `middleware.ts`
- Framer Motion components require `'use client'` directive at file top
- Pages with `'use client'` cannot export `metadata` — use separate `metadata.ts`
- Deploys to Cloudflare Pages via `wrangler pages deploy`

## Edge/Cloudflare Constraints

- **No Node.js built-ins** in workers — Edge compatibility required
- **No hardcoded secrets** — use `wrangler secret` or `hoox secrets` commands
- **No public APIs for internal workers** — `trade-worker`, `d1-worker` only accessible via service bindings
- Worker config: `workers.jsonc` (central) + per-worker `wrangler.jsonc`
- Infrastructure: D1 (SQLite), R2 (storage), KV (config), Durable Objects (idempotency), Queues (failover)
- Use `bun` for all scripting, testing, and package management

## Secret Management

Secrets stored in `workers.jsonc` under each worker's `secrets` array. Deploy with:
```bash
hoox secrets update-cf    # push secrets to Cloudflare
```

## TypeScript

- Strict mode enabled (`tsconfig.json`)
- Avoid `as any` — use proper typing with `WranglerConfig` and `Config` interfaces
- `@cloudflare/workers-types` for worker type definitions