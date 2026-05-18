---
title: "CLI Commands"
description: "Complete reference for the hoox command-line interface"
---

# CLI Commands

The `hoox` CLI has 15 command groups and 50+ subcommands (28 test files, part of the 106-test project suite).

## Quick Reference

```
hoox
├── init          Interactive setup wizard
├── clone         Clone worker repos as git submodules
├── dev           Local development (native or Docker)
├── deploy        Deploy workers, dashboard, Telegram webhook, KV config
├── infra         Manage D1, KV, R2, Queues, Vectorize, Analytics
├── config        Manage wrangler.jsonc, env vars, KV keys, secrets
├── check         Validate prerequisites, setup, and worker health
├── db            D1 database operations (apply, migrate, query, export, reset)
├── monitor       Health checks, recent trades, kill switch, logs, backup
├── repair        System check, per-component repair, guided rebuild
├── logs          Stream and filter worker logs
├── test          Run CI pipeline (lint &rarr; typecheck &rarr; test &rarr; build)
└── waf           Manage Cloudflare WAF rules
```

## Setup & Init

```
hoox init                          Interactive setup wizard
hoox clone [name]                  Bootstrap project from template
hoox check prerequisites           Validate tools and accounts
hoox check setup                   Full environment validation
hoox check health                  Probe worker health endpoints
```

## Development

```
hoox dev start [--runtime native|docker]    Start all workers
hoox dev worker <name>                      Start single worker
hoox dev dashboard                          Start Next.js dashboard
```

## Deployment

```
hoox deploy all [--auto] [--rebuild]                    Deploy all workers + dashboard
hoox deploy worker <name>                                Deploy single worker
hoox deploy dashboard [--rebuild]                        Build and deploy dashboard
hoox deploy telegram-webhook [--token] [--secret-token]  Set Telegram webhook
hoox deploy update-internal-urls                         Update dashboard service URLs
hoox deploy kv-config                                    Apply KV manifest defaults
```

## Infrastructure

```
hoox infra provision              Auto-provision all resources from config
hoox infra d1 list|create|delete  D1 database operations
hoox infra kv list|create|delete  KV namespace operations
hoox infra r2 list|create|delete  R2 bucket operations
hoox infra queues list|create|delete  Queue operations
hoox infra vectorize list|create|delete  Vectorize operations
hoox infra analytics list|create  Analytics Engine operations
```

## Configuration

```
hoox config env init              Interactive env variable setup
hoox config env show              Display env vars (secrets redacted)
hoox config env validate          Check all required vars set
hoox config env generate-dev-vars Generate per-worker .dev.vars
hoox config kv set|get|list|delete  KV key management
hoox config kv apply-manifest     Set all manifest keys to defaults
hoox config show|set              View/update wrangler.jsonc
hoox secrets update-cf|check|sync  Cloudflare secret management
```

## Database

```
hoox db apply [--remote]          Apply schema.sql to D1
hoox db migrate [--remote]        Run tracking migrations
hoox db list [--remote]           List all D1 tables
hoox db query <sql> [--remote]    Execute read-only SQL
hoox db export                    Export D1 to .sql file
hoox db reset --confirm           Drop and recreate D1 (DESTRUCTIVE)
```

## Monitoring

```
hoox monitor status               Probe all worker /health endpoints
hoox monitor trades [N]           Query recent trades (default: 10)
hoox monitor logs [worker]        Show recent system logs
hoox monitor kill-switch show|on|off  Emergency trading halt
hoox monitor queue-depth          List queues and depths
hoox monitor backup               Export D1 database
```

## Repair

```
hoox repair check                 Comprehensive 5-step system check
hoox repair worker <name>         Redeploy single worker
hoox repair infra                 Verify infrastructure exists
hoox repair secrets               Re-upload all secrets
hoox repair kv                    Reset KV keys to defaults
hoox repair db                    Re-apply schema + migrations
hoox repair rebuild               Full guided rebuild (DESTRUCTIVE)
```

## Logs & Diagnostics

```
hoox logs download <worker>       Download worker logs
hoox logs tail <worker>           Stream logs in real-time
hoox test                         Run CI pipeline
hoox waf                          Manage WAF rules
```

## Global Options

All commands support:

| Option    | Description                   |
| --------- | ----------------------------- |
| `--json`  | Machine-parseable JSON output |
| `--quiet` | Minimal output for scripting  |

> **Full reference:** [CLI Features & Commands](../devops/cli_features.md) for detailed descriptions of all subcommands.
