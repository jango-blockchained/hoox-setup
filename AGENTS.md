# Agent Instructions

## Project Structure

Monorepo using Bun workspaces: `packages/*`, `workers/*`, `pages/*`.

| Workspace                    | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `packages/cli`               | CLI tool (`hoox` commands)                               |
| `packages/shared`            | Shared router, middleware (auth/CORS/validation/rate-limit/logger), types, errors, analytics, D1 schemas/key registry |
| `workers/hoox`               | Gateway (webhook entrypoint)                             |
| `workers/trade-worker`       | Multi-exchange execution                                 |
| `workers/agent-worker`       | AI risk manager (5min cron)                              |
| `workers/d1-worker`          | D1 database operations                                   |
| `workers/telegram-worker`    | Notifications                                            |
| `workers/web3-wallet-worker` | DeFi/on-chain execution                                  |
| `workers/email-worker`       | Email signal parsing                                     |
| `workers/analytics-worker`   | Analytics & reporting                                    |
| `workers/report-worker`      | PDF reports via Browser Rendering                        |
| `workers/dashboard`          | Next.js 16 dashboard (Cloudflare Workers + OpenNext)     |

> **Note:** Dashboard lives at `workers/dashboard/`. The `pages/dashboard` path is legacy — actual dashboard code is in `workers/dashboard/`. `pages/docs/` contains the Astro docs site.

The `.opencode/` directory is the central project-intelligence knowledge hub:
- `.opencode/context/project-intelligence/` — architecture, tech-stack, CLI commands/services, worker/examples, endpoints, bindings, errors
- `.opencode/plans/` — implementation plans
- `.opencode/specs/` — design documents
- `.opencode/tasks/` — task breakdown JSONs for complex features
- `.opencode/tasks.md` — active refactoring plan (Phases 1-4)
- `.opencode/sessions/` — session context files
- `.opencode/external-context/` — fetched external documentation (Cloudflare Workers, etc.)
- `.opencode/skills/` — project-specific agent skills (shadcn, nextjs-build, task-management, bun-runtime)

## Commands

```bash
bun install              # install dependencies (never npm/yarn)
bun test                # run all unit tests (bun native runner)
bun test <path>         # run specific test file
bun run lint            # ESLint check
bun run typecheck       # TypeScript check (tsc --noEmit)
bun run build           # TypeScript build check
./hoox-tui              # launch TUI for local dev (all workers)
hoox workers deploy     # deploy all workers to Cloudflare
bun run deploy          # deploy dashboard to Cloudflare Workers
```

## CI Pipeline

`bun run lint` → `bun run typecheck` → `bun test` → `bun run build`

## Testing

- **Unit tests**: `bun test` (built-in runner), config in `bunfig.toml` (60s timeout, NODE_ENV=test)
- **Integration tests**: `vitest` + `@cloudflare/vitest-pool-workers`, config in `vitest.config.ts`
- **Live tests**: `bun test tests/live/ --jobs 1` (requires Cloudflare credentials)
- Coverage threshold: 80%
- Test files across all workers, `packages/shared`, `packages/cli`

## Local Development

```bash
hoox dev start                # start all workers (interactive: Native vs Docker)
hoox dev start --runtime native   # force native (wrangler dev)
hoox dev start --runtime docker   # force docker (docker compose)
hoox dev worker <name>        # single worker via wrangler dev
hoox dev dashboard            # Next.js dashboard dev server
```

**Dev runtime selection:**
- `hoox dev start` checks wrangler version (advisory warning if outdated)
- Detects Docker + Docker Compose availability
- If Docker is available and `docker-compose.yml` exists: prompts user to choose runtime
- Runtime preference saved to `wrangler.jsonc.dev.runtime` — subsequent runs don't re-prompt
- Override with `--runtime native|docker` flag

**Docker Compose profiles** (in `docker-compose.yml`):
- `workers` — all worker services
- `dashboard` — dashboard only
- `full` — workers + dashboard

```bash
docker compose --profile workers --profile dashboard up  # full stack
docker compose --profile workers up                        # workers only
```

## Dashboard (workers/dashboard)

- Next.js 16 with Turbopack: `next.config.ts`
- Uses `@opennextjs/cloudflare` adapter (not `@cloudflare/next-on-pages`)
- Build: `bunx opennextjs-cloudflare build` → creates `.open-next/worker.js`
- Deploy: `bunx wrangler deploy` (Cloudflare Workers, NOT Pages)
- Configuration: `wrangler.jsonc` with `main: ".open-next/worker.js"` and `assets.directory: ".open-next/assets"`
- Runtime: Node.js runtime via OpenNext adapter (full Next.js feature support)
- Static assets served via `ASSETS` binding from `.open-next/assets/`
- Framer Motion components require `'use client'` directive at file top
- Pages with `'use client'` cannot export `metadata` — use separate `metadata.ts`

## Edge/Cloudflare Constraints

- **No Node.js built-ins** in workers — Edge compatibility required
- **No hardcoded secrets** — use `wrangler secret` or `hoox secrets` commands
- **No public APIs for internal workers** — inter-worker communication via service bindings only
- **Smart Placement** enabled on 5 workers (trade-worker, d1-worker, telegram-worker, web3-wallet-worker, email-worker, analytics-worker) for 30-60% latency reduction
- Worker config: root `wrangler.jsonc` + per-worker `wrangler.jsonc`
- Infrastructure: D1 (SQLite), R2 (storage), KV (config), Durable Objects (idempotency), Queues (failover)
- Use `bun` for all scripting, testing, and package management

## Secret Management

Secrets stored in `wrangler.jsonc` under each worker's `secrets` array. Deploy with:

```bash
hoox secrets update-cf    # push secrets to Cloudflare
```

Local dev secrets go in `.dev.vars` (gitignored) per worker.

## TypeScript

- Strict mode enabled (`tsconfig.json`)
- Avoid `as any` — use proper typing
- `wrangler types` generates `worker-configuration.d.ts` per worker
- `@cloudflare/workers-types` for worker type definitions

## Agent Context Files

The `.opencode/` directory contains all project intelligence for AI agents:

| Path                                  | Description                                   |
| ------------------------------------- | --------------------------------------------- |
| `.opencode/context/project-intelligence/` | Architecture, tech stack, endpoints, bindings, errors, examples |
| `.opencode/plans/`                    | Implementation plans (19 plans)               |
| `.opencode/specs/`                    | Design documents (7 specs)                    |
| `.opencode/tasks.md`                  | Active 4-phase refactoring plan               |
| `.opencode/tasks/`                    | Task breakdown JSONs (deep-review, refactor-trade-d1) |
| `.opencode/sessions/`                 | Session context files                         |
| `.opencode/external-context/`         | Fetched external docs (Cloudflare Workers, etc.) |
| `.opencode/skills/`                   | Project-specific skills (shadcn, nextjs-build, task-management, bun-runtime) |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Email     │────▶│                  │     │   Agent Worker   │
│   Worker    │     │   Hoox Gateway   │────▶│  (AI Risk Mgr)   │
└─────────────┘     │   (Webhook)      │     └────────┬────────┘
                    │                  │              │
┌─────────────┐     │  Auth/CORS/      │     ┌────────▼────────┐
│  Telegram   │────▶│  Validation/     │     │   Trade Worker   │
│  Worker     │     │  Rate-Limit      │     │  (Multi-Exchange)│
└─────────────┘     │  Middleware      │     └────────┬────────┘
                    │                  │              │
┌─────────────┐     └────────┬─────────┘              │
│   Web3      │              │                        │
│ Wallet Wkr  │              │                        │
└─────────────┘              ▼                        │
                    ┌──────────────────┐              │
                    │   D1 Worker      │◄─────────────┘
                    │  (Data Access)   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐     ┌─────────────────┐
                    │   Analytics      │     │  Report Worker   │
                    │   Worker         │────▶│  (PDF Reports)   │
                    └──────────────────┘     └─────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Dashboard (workers/dashboard)           │
│  Next.js 16 · OpenNext/Cloudflare · Service Bindings     │
│  Connects to D1 Worker + Agent Worker via bindings        │
└─────────────────────────────────────────────────────────┘
```

**Communication pattern:** Internal workers communicate via Cloudflare Service Bindings (not public URLs). The Hoox Gateway is the only user-facing entry point. The Dashboard has its own public URL but uses service bindings to reach internal workers.

> **See [DESIGN.md](DESIGN.md) for detailed architecture diagrams, data models (DDL), infrastructure bindings, service binding maps, and UI/UX design rules.**
