---
title: "Hoox CLI Features & Commands"
---

# Hoox CLI Features & Commands

The `hoox` CLI is the central management tool for the Hoox Trading System (28 test files, 15 command groups, 50+ subcommands).

## Quick Reference

```
hoox
├── init          Interactive setup wizard
├── clone         Clone worker repos as submodules
├── dev           Local development (native/docker)
├── deploy        Deploy workers, dashboard, telegram webhook, KV config
├── infra         Manage D1, KV, R2, Queues, Vectorize, Analytics
├── config        Manage config, env vars, KV keys, secrets
├── check         Validate prerequisites, setup, health
├── db            D1 database operations (apply, migrate, query, export, reset)
├── monitor       Health checks, trades, logs, kill switch, queue, backup
├── repair        Diagnosis, repair, guided rebuild
├── logs          Stream worker logs
├── test          Run CI pipeline
├── waf           Manage WAF rules
└── dashboard     Dashboard operations
```

## Initialization & Setup

- `hoox init`: Interactive setup wizard. Guides through Cloudflare credentials, AI provider integration (OpenAI, Anthropic, Google AI, Home Assistant), worker configuration, and exchange API keys.
- `hoox clone [name]`: Clone worker repositories as git submodules.
- `hoox check prerequisites`: 7 tool/account/repository checks — bun, git, node, wrangler, cloudflare-auth, docker, repository.
- `hoox check setup`: Full environment validation.
- `hoox check health`: Worker health endpoint probing.

## Infrastructure Management

- `hoox infra provision`: Auto-provision all infrastructure from wrangler.jsonc (D1 + KV + R2 + Queues).
- `hoox infra d1 list|create|delete`: D1 SQL databases.
- `hoox infra kv list|create|delete`: KV namespaces.
- `hoox infra r2 list|create|delete`: R2 object storage buckets.
- `hoox infra queues list|create|delete`: Cloudflare Queues.
- `hoox infra vectorize list|create|delete`: Vectorize vector database indexes.
- `hoox infra analytics list|create`: Analytics Engine datasets.

## Configuration

- `hoox config env init`: Interactive setup for 31 environment variables across 8 sections (Cloudflare Account, Internal Auth, Telegram, AI Providers, Exchanges, Email, Wallet, Dashboard).
- `hoox config env show`: Display environment variables (secrets redacted).
- `hoox config env validate`: Check all required vars are set.
- `hoox config env generate-dev-vars`: Generate per-worker `.dev.vars` from `.env.local`.
- `hoox config kv set|get|list|delete`: KV key management for CONFIG_KV namespace.
- `hoox config kv apply-manifest`: Set all 16 manifest keys to defaults.
- `hoox config kv manifest`: Show expected key manifest.
- `hoox config show|set`: View or update `wrangler.jsonc`.
- `hoox secrets update-cf|check|sync`: Cloudflare secret management.

## Deployment

- `hoox deploy all [--auto] [--rebuild]`: Deploy all workers + dashboard in correct dependency order.
  - `--auto`: Skip dashboard rebuild prompt, use existing build.
  - `--rebuild`: Force rebuild dashboard.
- `hoox deploy workers`: Workers only (skip dashboard).
- `hoox deploy worker <name>`: Single worker.
- `hoox deploy dashboard [--rebuild]`: Build and deploy Next.js dashboard via OpenNext.
- `hoox deploy telegram-webhook [--token] [--secret-token] [--subdomain]`: Set Telegram bot webhook post-deployment. Reads tokens from `.env.local` by default or CLI flags.
- `hoox deploy update-internal-urls`: Update dashboard `wrangler.jsonc` with current worker service URLs.
- `hoox deploy kv-config`: Apply KV manifest defaults to CONFIG_KV namespace.

## Database Operations

- `hoox db apply [--remote]`: Apply schema.sql to D1.
- `hoox db migrate [--remote]`: Run tracking migrations.
- `hoox db list [--remote]`: List all D1 tables.
- `hoox db query <sql> [--remote]`: Execute read-only SQL queries.
- `hoox db export`: Export D1 to timestamped `.sql` file.
- `hoox db reset --confirm`: Drop and recreate D1 (DESTRUCTIVE).

## Monitoring

- `hoox monitor status`: Probe all worker `/health` endpoints.
- `hoox monitor trades [N]`: Query recent trades from D1 (default: 10, max: 100).
- `hoox monitor logs [worker]`: Recent system logs from D1 `system_logs` table.
- `hoox monitor kill-switch show|on|off`: Emergency trading halt via `trade:kill_switch` KV key.
- `hoox monitor queue-depth`: List queues via wrangler.
- `hoox monitor backup`: Export D1 database to timestamped `.sql`.

## Repair & Recovery

- `hoox repair check`: 5-step comprehensive system check (submodules, deps, TypeScript, infra, secrets).
- `hoox repair worker <name>`: Redeploy a single worker.
- `hoox repair infra`: Verify D1, KV, R2, Queues exist.
- `hoox repair secrets`: Re-upload all secrets from `.dev.vars`.
- `hoox repair kv`: Reset CONFIG_KV keys to manifest defaults.
- `hoox repair db`: Re-apply schema + tracking migrations.
- `hoox repair rebuild`: Interactive guided rebuild — backup, delete/recreate D1, deploy all, apply schema, reset KV.

## Worker Management

- `hoox dev start [--runtime native|docker]`: Start all workers locally. Prompts for runtime (Native via wrangler or Docker via compose). Saves preference to `wrangler.jsonc.dev.runtime`.
- `hoox dev worker <name>`: Start a single worker.
- `hoox dev dashboard`: Start the Next.js dashboard dev server.

## Logs & Diagnostics

- `hoox logs download <workerName>`: Async download of worker logs from R2 bucket, with fallback to `wrangler tail`.
- `hoox logs tail <workerName>`: Tail worker logs in real-time.
- `hoox waf`: Configure Cloudflare WAF rules (IP allowlists, rate limiting).
- `hoox test`: Run CI pipeline (lint → typecheck → test → build).

## Global Options

All commands support:

- `--json`: Machine-parseable JSON output.
- `--quiet`: Minimal output (for scripting).

## Background System Processes

While the CLI manages the development lifecycle, the deployed system runs several critical background tasks automatically on Cloudflare's edge:

1. **Housekeeping Cron (`agent-worker`)** — Every 5 minutes: portfolio monitoring, trailing stop checks, worker health validation.
2. **Idempotency Store (`hoox` gateway)** — Durable Object deduplication for incoming webhooks — prevents duplicate trade signals.
3. **Kill Switch Evaluation** — Read from `CONFIG_KV` on every request. Immediately halts all trade execution without redeployment.
4. **Queue Processing (`trade-execution`)** — High-availability queue bridging gateway and trade-worker with automatic failover and retry.
