---
title: "Database Operations"
description: "How to manage, migrate, query, backup, and restore your edge SQLite D1 database in development and production."
---

# 🗄️ Database Operations

Hoox utilizes **Cloudflare® D1**—a fully serverless, highly optimized SQLite database engine distributed globally across Cloudflare's edge network. This document serves as your operational runbook for executing database schemas, running schema migrations, querying transaction ledgers, and performing secure database backup and recovery.

---

## 🏗️ The 5 Core Database Tables

The database schema defines five fundamental tables designed for trading operations:

1. **`trades`**: The primary ledger. Stores execution prices, contract quantities, timestamps, transaction fees, and exchange order IDs.
2. **`positions`**: Tracks open margin/futures exposure (average entry price, size, leverage, direction).
3. **`balances`**: Periodic snapshots of account equity, margin balance, and available free collateral.
4. **`trade_signals`**: Historical record of every raw incoming webhook alert before execution processing.
5. **`system_logs`**: Crucial debug and error messages offloaded from compute nodes.

---

## ⚡ Applying Schemas & Tables

When launching a new workspace, you must initialize the required tables. The Hoox CLI handles this via declarative migration scripts:

```bash
# 1. Apply schema and seed initial tables to local dev SQLite
hoox db apply

# 2. Deploy schema and seed tables directly to live production Cloudflare D1
hoox db apply --remote
```

> **Warning:** Running `hoox db apply` compiles migrations and seeds the database locally. For production deployment, you **must** append the `--remote` flag to execute operations directly on your active Cloudflare D1 instance.

---

## 🔄 Managing Database Migrations

When new features are added that require changes to the database structure, you must run migrations:

```bash
# List all applied and pending database migrations in production
hoox db migrate status --remote

# Apply all pending schema migrations sequentially to production D1
hoox db migrate --remote
```

The migration engine tracks history inside a special `d1_migrations` table, ensuring that migrations are never executed twice or applied in the wrong sequence.

---

## 🔎 Inspecting & Querying Data from the CLI

The Hoox CLI features a built-in SQL interface allowing you to run arbitrary queries directly against your local or remote database:

```bash
# A. List all active tables in your production database
hoox db list --remote

# B. Count the total number of executed trades
hoox db query "SELECT COUNT(*) FROM trades" --remote

# C. Inspect the 5 most recent trade fills with formatting
hoox db query "SELECT created_at, symbol, action, price, quantity FROM trades ORDER BY created_at DESC LIMIT 5" --remote

# D. Check currently open positions on Bybit
hoox db query "SELECT symbol, side, size, entry_price FROM positions WHERE size > 0" --remote
```

---

## 📥 Backup & Export Workflows

To secure your historical P&L records, transaction ledger, and bot performance telemetry, execute regular exports:

```bash
# Export the entire D1 database as a clean SQL script
hoox db export --remote
```

### Export Output & Structure

The export command creates a timestamped SQL dump inside your workspace directory:
`backups/db-backup-2026-05-19-174000.sql`

This file contains standard DDL and DML commands:

```sql
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS trades (...);
INSERT INTO trades VALUES(...);
COMMIT;
```

---

## ⚠️ Database Reset (Destructive Operations)

If you are running simulated paper trading and wish to wipe all ledger history to start fresh, you can reset the tables:

```bash
# Wipe all tables in the local development database
hoox db reset --confirm

# Wipe all tables in the live production D1 database (USE WITH EXTREME CAUTION)
hoox db reset --remote --confirm
```

> **Danger:** Wiping your production D1 database is an irreversible operation. It will permanently delete all trade logs, position records, and asset histories. **Always** execute `hoox db export --remote` before running a reset!

### 🔗 Next Steps

- **[Local Development & Testing](local-development.md)** — Run your local V8 wrangler isolates with local D1 SQLite bindings.
- **[Infrastructure Management](manage-infra.md)** — Manage KV config namespaces, Queue parameters, and R2 storage buckets.
