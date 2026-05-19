---
title: "Self-Healing & Repair"
description: "How to run automatic diagnostic checks, perform targeted component repairs, and execute full interactive system rebuilds."
---

# 🛠️ Self-Healing & Repair

Algorithmic trading environments must be resilient and self-healing. If you experience deployment failures, database routing discrepancies, expired authentication tokens, or missing git submodules, the Hoox CLI features a dedicated **`hoox repair`** command group designed to diagnose issues, check infrastructure status, and recover your workspace automatically.

---

## 🔍 1. Running the 5-Step System Diagnostics

If your trading gateway throws errors or the dashboard reports connection issues, run a comprehensive diagnostic sweep:

```bash
# Execute the automated 5-step repair check
hoox repair check
```

The diagnostics engine runs a strict, sequential analysis of your entire monorepo environment:

```
┌────────────────────────────────────────────────────────┐
│               hoox Repair Diagnostic Checklist         │
├────────────────────────────────────────────────────────┤
│  [Step 1] Submodule Integrity ......... ✅ COMPLETED   │
│  [Step 2] Dependency Resolutions ....... ✅ COMPLETED   │
│  [Step 3] TypeScript Type Safety ...... ✅ COMPLETED   │
│  [Step 4] Cloudflare Edge Bindings .... ✅ COMPLETED   │
│  [Step 5] Hardware Secrets Validation . ✅ COMPLETED   │
│                                                        │
│  Diagnostic Result: 0 errors detected                  │
└────────────────────────────────────────────────────────┘
```

1. **Submodule Check**: Verifies that all 9 worker folders under `workers/` are fully populated and registered in Git.
2. **Dependency Check**: Audits `node_modules` across Bun workspaces for missing or duplicate libraries.
3. **Type Safety Check**: Compiles the CLI and shared packages to catch syntax or interface errors.
4. **Edge Bindings Check**: Connects to Cloudflare’s APIs to verify that your D1, KV, and Queue namespaces physically exist on your account.
5. **Secrets Check**: Audits your Workers Secrets to ensure exchange keys and Telegram tokens are securely bound.

---

## 🩹 2. Targeted Component Repairs

If a diagnostic check fails, you do not need to redeploy the entire stack. You can run highly targeted repairs:

```bash
# A. Re-verify, provision, and repair missing Cloudflare bindings
hoox repair infra

# B. Re-audit and sync encrypted Workers Secrets to Cloudflare
hoox repair secrets

# C. Reset the CONFIG_KV configuration namespace to default variables
hoox repair kv

# D. Re-apply drizzle DQL schemas and run pending D1 database migrations
hoox repair db

# E. Rebuild and redeploy a single, degraded worker
hoox repair worker trade-worker
```

---

## ⚡ 3. Full System Interactive Rebuild

In the event of a catastrophic system failure (e.g. lost Cloudflare credentials, corrupted SQLite files, or major monorepo drift), you can execute a full, interactive self-healing rebuild:

```bash
# Execute an interactive, guided workspace rebuild
hoox repair rebuild
```

### The Rebuild Sequence

When triggered, the CLI walks you through a structured recovery protocol:

1. **D1 Database Backup**: Automatically exports your current D1 ledger as a secure `.sql` file in `backups/recovery-pre-rebuild.sql`.
2. **Infrastructure Tear-Down**: Deletes corrupted D1, KV, and Queue instances.
3. **Fresh Provisioning**: Recreates all database tables and config buckets on Cloudflare.
4. **Sequenced Redeployment**: Re-compiles and deploys all 9 edge workers in correct dependency sequence.
5. **Database Seeding**: Restores your backup SQL data and re-applies schema migrations.
6. **KV Sync**: Applies the 16-key configuration manifest defaults.

> **Danger:** The `hoox repair rebuild` command performs destructive resets on D1 and KV instances. Ensure you carefully read the interactive prompts and confirm database backup completion before letting the script proceed!

---

## 📋 4. Common Troubleshooting Scenarios

| Symptom / Failure              | Primary Root Cause                                    | CLI Healing Action                                                                        |
| :----------------------------- | :---------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `bun install` or build crashes | Git submodules are empty or out of sync.              | `git submodule update --init --recursive`                                                 |
| `D1_ERROR: no such table`      | SQLite D1 tables were not initialized.                | `hoox db apply --remote`                                                                  |
| `500 Internal Server Error`    | Missing or rotated exchange API secrets.              | `hoox secrets set BYBIT_API_KEY "key"` followed by `hoox deploy update-internal-urls`.    |
| Telegram Bot is mute           | BotFather token is wrong, or webhook is unregistered. | `hoox secrets set TELEGRAM_BOT_TOKEN "token"` followed by `hoox deploy telegram-webhook`. |

### 🔗 Next Steps

- **[Monitoring Operations Guide](monitor-trading.md)** — Audit system status, tail console logs, and verify fills.
- **[CLI Reference Manual](../reference/cli-commands.md)** — Review all CLI commands, options, and JSON flags.
