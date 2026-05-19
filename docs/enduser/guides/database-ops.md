---
title: "Database Operations"
description: "Manage your D1 database — schema, migrations, queries, and backups"
---

# Database Operations

## Apply Schema

```bash
# Apply to local (development)
hoox db apply

# Apply to production
hoox db apply --remote
```

This creates the required tables: `trade_signals`, `trades`, `positions`, `balances`, `system_logs`.

## Run Migrations

```bash
hoox db migrate --remote
```

## List Tables

```bash
hoox db list --remote
```

## Query Data

```bash
# Count recent trades
hoox db query "SELECT COUNT(*) FROM trades" --remote

# Show latest signals
hoox db query "SELECT * FROM trade_signals ORDER BY timestamp DESC LIMIT 5" --remote
```

## Export

```bash
hoox db export
```

Saves a timestamped `.sql` file with your full database.

## Reset (Destructive)

```bash
hoox db reset --confirm
```

> ⚠️ This deletes all data. Use with extreme caution — export first.

## Next Steps

- [Infrastructure Guide](manage-infra.md) — Manage D1 alongside other services
