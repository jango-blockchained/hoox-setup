---
title: "Repair & Recovery"
description: "Diagnose and fix system issues"
---

# Repair & Recovery

## Quick Check

```bash
hoox repair check
```

Runs a 5-step comprehensive check: submodules → dependencies → TypeScript → infrastructure → secrets.

## Per-Component Repair

```bash
# Redeploy a single worker
hoox repair worker trade-worker

# Verify infrastructure exists
hoox repair infra

# Re-upload secrets
hoox repair secrets

# Reset KV keys to defaults
hoox repair kv

# Re-apply schema + migrations
hoox repair db
```

## Full Rebuild

If everything is broken:

```bash
hoox repair rebuild
```

This interactive command:

1. Backs up your D1 database
2. Deletes and recreates D1
3. Redeploys all workers
4. Re-applies the schema
5. Resets KV configuration

> ⚠️ **Destructive.** Your D1 data will be erased. Backup before proceeding.

## Troubleshooting

| Symptom                | Fix                                       |
| ---------------------- | ----------------------------------------- |
| `bun install` fails    | `git submodule update --init --recursive` |
| Worker deploy fails    | `hoox secrets update-cf`                  |
| 502 Bad Gateway        | Deploy dependency workers first           |
| D1 query fails         | `hoox db apply --remote`                  |
| Telegram not receiving | `hoox deploy telegram-webhook`            |
