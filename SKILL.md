---
name: hoox-development
description: Use when working on the Hoox trading system - developing workers, deploying, debugging, or modifying system configuration
---

# Hoox Development

## Overview

Specialized skills for AI agents working on the Hoox trading system - a Cloudflare Workers-based trading platform with multi-exchange execution.

## When to Use

**Start here for ANY Hoox-related task.**

- Worker development → Use hoox-development skill
- Deploying workers → Use deployment skill
- Debugging issues → Use troubleshooting skill
- Database operations → Use database skill
- Security modifications → Use security skill
- Running tests → Use testing skill
- Configuration changes → Use configuration skill

## Core Skills

### 1. Worker Development

```bash
# Local testing
bun run scripts/manage.ts workers dev <worker-name>

# Deploy single worker
bun run scripts/manage.ts workers deploy <worker-name>

# Check status
bun run scripts/manage.ts workers status
```

**Key paths:**
- Workers: `workers/*/src/index.ts`
- Config: `workers/*/wrangler.jsonc`
- Dashboard: `pages/dashboard/` (Cloudflare Pages, NOT a Worker)

### 2. Deployment

```bash
# Clone workers first (if needed)
bun run scripts/manage.ts workers clone

# Deploy all workers
bun run scripts/manage.ts workers deploy

# Deploy single worker
bun run scripts/manage.ts workers deploy hoox
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
bun run scripts/manage.ts housekeeping
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

- All inter-worker communication: `X-Internal-Auth-Key` header
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

- Global: `config.toml` or `workers.jsonc`
- Worker: `workers/*/wrangler.jsonc`
- Secrets: `wrangler secret put <name> --worker <worker>`
- Pages: `pages.jsonc`

## Quick Reference

| Task | Command |
|------|---------|
| Dev server | `bun run scripts/manage.ts workers dev <name>` |
| Deploy | `bun run scripts/manage.ts workers deploy <name>` |
| Test | `bun test workers/<name>` |
| Logs | `bunx wrangler tail <name>` |
| Housekeeping | `bun run scripts/manage.ts housekeeping` |

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