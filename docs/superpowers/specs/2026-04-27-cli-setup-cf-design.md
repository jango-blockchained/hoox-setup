# Hoox CLI Enhanced Setup & Cloudflare Management

> **Agent Instructions:** Use superpowers:subagent-driven-development to implement task-by-task.

## Overview

Comprehensive CLI extensions for setup automation, Cloudflare resource management, Enhanced worker operations, and wizard refactoring.

## Architecture

### Module Structure
```
packages/hoox-cli/src/
├── commands/
│   ├── setup.ts           # Setup subcommands (validate, repair, export)
│   ├── cf/
│   │   ├── d1.ts        # D1 database operations
│   │   ├── r2.ts        # R2 bucket operations  
│   │   ├── kv.ts         # KV namespace operations
│   │   ├── queues.ts     # Queue operations
│   │   ├── secrets.ts   # Secret Store operations
│   │   └── zones.ts    # DNS zone operations
│   └── workers/
│       ├── repair.ts     # Worker repair commands
│       ├── logs.ts      # Log tailing
│       ├── metrics.ts   # Worker analytics
│       └── rollback.ts # Version rollback
├── wizard/
│   ├── index.ts         # Enhanced wizard entry
│   ├── steps/           # Refactored wizard steps
│   └── hooks/           # Shared validation hooks
└── lib/
    ├── cf-client.ts     # Cloudflare API client
    └── validation.ts  # Shared validation logic
```

---

## Commands

### `hoox setup:validate`

Performs comprehensive pre-flight validation:

- **Dependencies**: bun, git, wrangler versions
- **Auth**: Cloudflare token, account access
- **Config**: workers.jsonc schema validation
- **Workers**: Directory existence, git submodules
- **Resources**: D1/R2/KV existence check

**Flags:**
- `--verbose` - Detailed output
- `--fix` - Auto-fix minor issues

### `hoox setup:repair`

Automatically repairs common issues:

- Re-provisions missing submodules
- Fixes broken bindings
- Re-runs D1 migrations
- Updates wrangler configs
- Re-authenticates if needed

### `hoox setup:export`

Exports configuration for backup:

- JSON export of workers.jsonc
- Environment template generation
- Secrets checklist (excludes values)

### `hoox cf d1`

**Subcommands:**
- `hoox cf d1 list` - List all D1 databases
- `hoox cf d1 create <name>` - Create new D1 database
- `hoox cf d1 migrate <worker>` - Run migrations for worker
- `hoox cf d1 backup <name>` - Create backup
- `hoox cf d1 restore <name> <backup>` - Restore from backup

### `hoox cf r2`

**Subcommands:**
- `hoox cf r2 list` - List R2 buckets
- `hoox cf r2 create <name>` - Create bucket
- `hoox cf r2 configure <bucket>` - Configure lifecycle rules
- `hoox cf r2 logs <bucket>` - Fetch access logs

### `hoox cf kv`

**Subcommands:**
- `hoox cf kv list` - List KV namespaces
- `hoox cf kv create <name>` - Create namespace
- `hoox cf kv get <ns> <key>` - Get value
- `hoox cf kv set <ns> <key> <value>` - Set value
- `hoox cf kv delete <ns> <key>` - Delete key

### `hoox cf secrets`

**Subcommands:**
- `hoox cf secrets list` - List secrets in store
- `hoox cf secrets get <secret>` - Get secret metadata
- `hoox cf secrets set <secret> <value>` - Set secret value
- `hoox cf secrets delete <secret>` - Delete secret

### `hoox cf queues`

**Subcommands:**
- `hoox cf queues list` - List queues
- `hoox cf queues create <name>` - Create queue
- `hoox cf queues configure <queue>` - Configure DLQ, retention

### `hoox workers repair`

Repairs worker configuration:

- Rebuilds all bindings
- Re-provisions D1/R2/KV
- Re-runs migrations
- Validates secrets

### `hoox workers logs`

**Flags:**
- `--worker <name>` - Filter by worker
- `--level <info|error|warn>` - Filter by level
- `--follow` - Live tail mode

### `hoox workers metrics`

Fetches worker analytics:

- Requests count
- Data transfer
- Execution time
- Error rate

### `hoox workers rollback`

Rollback to previous version:

- Lists previous deployments
- Prompts for version selection
- Re-deploys selected version

---

## Enhanced Wizard

### Refactoring Goals

- **Modular steps** - Each step in separate file
- **Validation hooks** - Pre/post validation per step
- **Resume support** - Full state persistence
- **Dry-run mode** - Preview without execution
- **Verbose logging** - Detailed progress

### New Steps

1. **Dependency Check** - Auto-install missing deps
2. **Environment Setup** - Cloudflare auth flow
3. **Worker Selection** - Interactive + config
4. **Resource Provisioning** - Auto-create D1/R2/KV
5. **Secrets Management** - Secure input flow
6. **Preview** - Summary before deploy
7. **Deploy** - Orchestrated deployment
8. **Verification** - Post-deploy health check

---

## Background Tasks (Via Cron)

### Housekeeping Cron (`agent-worker`)

Enhanced monitoring:

- Portfolio balance checks
- Position health validation
- Worker uptime monitoring
- D1 backup verification

### Alert System

- Telegram notifications on errors
- Daily summary reports
- Emergency alerts (kill switch triggered)

---

## Tech Stack

- **Runtime**: Bun
- **CLI Framework**: Ink (React-based TUI)
- **API Client**: Cloudflare Workers API via fetch
- **Validation**: Zod schemas
- **Testing**: Vitest

---

## Success Criteria

1. All new commands execute without errors
2. Wizard resumes cleanly from any step
3. Repair fixes 90% of common issues
4. No breaking changes to existing commands
5. All exported types are strict