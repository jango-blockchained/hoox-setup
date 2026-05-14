---
name: hoox-development
description: Use when working on the Hoox trading system - developing workers, deploying, debugging, or modifying system configuration
---

# Hoox Development

## Overview

Specialized skills for AI agents working on the Hoox trading system — a Cloudflare Workers-based trading platform with 10 workers, multi-exchange execution, and a Next.js 16 dashboard.

## When to Use

**Start here for ANY Hoox-related task.**

- Worker development → Use hoox-development skill
- Deploying workers → Use deployment skill
- Debugging issues → Use troubleshooting skill
- Database operations → Use database skill
- Security modifications → Use security skill
- Running tests → Use testing skill
- Configuration changes → Use configuration skill

## Agent Context Files

The `.opencode/` directory is the central project-knowledge hub:

| Path | Description | Priority |
|------|-------------|----------|
| `.opencode/context/project-intelligence/` | Architecture, tech stack, CLI, endpoints, bindings, errors, examples | critical |
| `.opencode/context/project-intelligence/concepts/architecture.md` | Worker architecture, service binding mesh, worker map | critical |
| `.opencode/context/project-intelligence/concepts/tech-stack.md` | Tech stack, versions, tooling | critical |
| `.opencode/context/project-intelligence/guides/cli-commands.md` | CLI command reference | critical |
| `.opencode/context/project-intelligence/guides/cli-services.md` | CLI service architecture | high |
| `.opencode/context/project-intelligence/guides/docs-site.md` | Astro docs site setup | high |
| `.opencode/context/project-intelligence/guides/local-dev.md` | Local dev workflow | high |
| `.opencode/context/project-intelligence/examples/worker-setup.md` | Worker config examples | high |
| `.opencode/context/project-intelligence/examples/api-patterns.md` | API endpoint patterns | high |
| `.opencode/context/project-intelligence/lookup/endpoints.md` | Endpoint quick reference | medium |
| `.opencode/context/project-intelligence/lookup/bindings.md` | Service bindings reference | medium |
| `.opencode/context/project-intelligence/errors/common.md` | Common errors & fixes | medium |
| `.opencode/plans/` | Implementation plans (19+) | high |
| `.opencode/specs/` | Design documents (7) | high |
| `.opencode/tasks.md` | Active 4-phase refactoring plan | critical |
| `.opencode/tasks/` | Task breakdown JSONs | medium |
| `.opencode/skills/` | Project-specific agent skills | medium |
| `.opencode/external-context/` | Fetched Cloudflare docs | medium |
| `.opencode/sessions/` | Session history | low |

## Core Skills

### 1. Worker Development

```bash
# Local testing
hoox workers dev <worker-name>

# Deploy single worker
hoox workers deploy <worker-name>

# Check status
hoox workers status
```

**Key paths:**

- Workers: `workers/*/src/index.ts`
- Config: `workers/*/wrangler.jsonc`
- Dashboard: `workers/dashboard/` (Next.js 16 + OpenNext on Cloudflare Workers)

**10 workers:**

| Worker | Role | Cron | Public | Smart Placement |
|--------|------|------|--------|-----------------|
| hoox | Gateway entry point | No | ✅ | ✅ |
| trade-worker | Multi-exchange execution | No | ❌ | ✅ |
| agent-worker | AI risk manager | ✅ (\*/5) | ❌ | ✅ |
| telegram-worker | Notifications | No | ❌ | ✅ |
| d1-worker | Database operations | No | ❌ | ✅ |
| web3-wallet-worker | DeFi/on-chain | No | ❌ | ✅ |
| email-worker | Email parsing | ✅ (\*/5) | ❌ | ✅ |
| analytics-worker | Analytics & reporting | No | ❌ | ✅ |
| report-worker | PDF reports | ✅ 06+18UTC | ❌ | ✅ |
| dashboard | Next.js 16 UI | No | ✅ | — |

### 2. Deployment

```bash
# Clone workers first (if needed)
hoox workers clone

# Deploy all workers
hoox workers deploy

# Deploy single worker
hoox workers deploy hoox
```

### 3. Troubleshooting

**Endpoints:**

- `GET /health` - Worker health check
- `GET /api/logs?limit=50` - Recent system logs
- `POST /agent/housekeeping` - Run health checks

**Commands:**

```bash
# View live logs
bunx wrangler tail <worker-name>

# Run housekeeping
hoox housekeeping
```

**Common issues:**

- Rate limiting: Check `kill_switch` in KV
- Failed trades: Check queue dead letter
- Exchange errors: Check R2 reports bucket

### 4. Database

**Database ID:** `a682f084-594e-4bd8-be2d-40ea5f8cf42e`

**Key tables:**

- `trade_signals` - Incoming signals
- `trades` - Executed trades
- `positions` - Active positions
- `balances` - Balance snapshots
- `system_logs` - Observability

**Schema:** `workers/trade-worker/schema.sql`

### 5. Security

- All inter-worker communication via Cloudflare Service Bindings (no public URLs)
- Dashboard: httpOnly cookie sessions (24hr expiry)
- hoox: validates `apiKey` in webhook payloads
- Secrets: Cloudflare Secret Store

**KV Keys:**

- `webhook:tradingview:ip_check_enabled`
- `webhook:tradingview:allowed_ips`
- `kill_switch`

### 6. Testing

```bash
bun test                      # Run all tests
bun test workers/<worker-name> # Test specific worker
bun test:watch               # Watch mode
```

**Test files:** `workers/*/test/*.test.ts`

### 7. Configuration

- Global: `wrangler.jsonc`
- Worker: `workers/*/wrangler.jsonc`
- Secrets: `wrangler secret put <name> --worker <worker>`
- Dashboard: `workers/dashboard/wrangler.jsonc` (Cloudflare Workers + OpenNext, NOT Pages)

## Architecture

### Service Binding Mesh

Internal workers communicate via Cloudflare Service Bindings (not public URLs). The hoox gateway is the only user-facing entry point. The dashboard has its own public URL but uses service bindings to reach internal workers.

```
hoox ──→ analytics-worker, trade-worker, telegram-worker
trade-worker ──→ d1-worker, telegram-worker, analytics-worker
agent-worker ──→ d1-worker, trade-worker, telegram-worker
telegram-worker ──→ analytics-worker
d1-worker ──→ analytics-worker
web3-wallet-worker ──→ telegram-worker, analytics-worker
email-worker ──→ trade-worker, analytics-worker
report-worker ──→ telegram-worker
dashboard ──→ d1-worker, agent-worker
analytics-worker → (called by 6 workers, no outbound bindings)
```

### Communication Pattern

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
│              Dashboard (workers/dashboard)               │
│  Next.js 16 · OpenNext/Cloudflare · Service Bindings     │
│  Connects to D1 Worker + Agent Worker via bindings        │
└─────────────────────────────────────────────────────────┘
```

## Infrastructure Bindings

| Binding | Type | Used By |
|---------|------|---------|
| `*_SERVICE` | Service Binding | hoox, trade, agent, telegram, d1, web3, email, report, dashboard |
| `CONFIG_KV` | KV Namespace | hoox, trade, agent, telegram, d1, email, dashboard |
| `*_BUCKET` | R2 Bucket | trade, telegram, report |
| `TRADE_QUEUE` | Queue | hoox (producer), trade (consumer) |
| `IDEMPOTENCY_STORE` | Durable Object | hoox |
| `DB` | D1 Database | trade, agent, d1 |
| `AI` | Workers AI | hoox, agent, telegram |
| `*_INDEX` | Vectorize | hoox, telegram |
| `ANALYTICS_ENGINE` | Analytics Engine | analytics-worker |
| `BROWSER` | Browser Rendering (REST API) | report-worker |

**Common config pattern:**

```jsonc
{
  "services": [{ "binding": "TRADE_SERVICE", "service": "trade-worker" }],
  "kv_namespaces": [{ "binding": "CONFIG_KV", "id": "<id>" }],
  "d1_databases": [{ "binding": "DB", "database_name": "hoox-db", "database_id": "<id>" }],
  "queues": { "producers": [{ "queue": "trade-execution", "binding": "TRADE_QUEUE" }] },
  "ai": { "binding": "AI" },
  "vectorize": [{ "binding": "VECTORIZE_INDEX", "index_name": "my-rag-index" }],
  "analytics_engine_datasets": [{ "binding": "ANALYTICS_ENGINE", "dataset": "hoox-analytics" }],
  "durable_objects": { "bindings": [{ "name": "IDEMPOTENCY_STORE", "class_name": "IdempotencyStore" }] },
  "placement": { "mode": "smart" },
  "observability": { "enabled": true, "head_sampling_rate": 1 }
}
```

## Quick Reference

| Task         | Command                      |
| ------------ | ---------------------------- |
| Dev server   | `hoox workers dev <name>`    |
| Deploy       | `hoox workers deploy <name>` |
| Test         | `bun test workers/<name>`    |
| Logs         | `bunx wrangler tail <name>`  |
| Housekeeping | `hoox housekeeping`          |

## Common Mistakes

- **Worker not found:** Clone workers first with `workers clone`
- **Config not loading:** Ensure `wrangler.jsonc` is valid JSONC
- **Secrets missing:** Use `wrangler secret list` to verify
- **Deployment fails:** Check `.dev.vars` file exists

## Project Files

- AGENTS.md - Full system documentation
- `workers/*/src/index.ts` - Worker entry points
- `workers/*/wrangler.jsonc` - Worker configuration
- `workers/trade-worker/schema.sql` - Database schema
- `.opencode/` - Central project-knowledge hub (context, plans, specs, tasks, skills, sessions)
