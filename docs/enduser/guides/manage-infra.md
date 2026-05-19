---
title: "Manage Infrastructure"
description: "Provision and manage D1, KV, R2, Queues, and Vectorize"
---

# Manage Infrastructure

> **What is infrastructure?** Hoox uses several Cloudflare services to run. This guide covers how to create, configure, and manage them using `hoox infra`.

## Quick Provisioning

```bash
# Auto-provision everything defined in wrangler.jsonc
hoox infra provision
```

This creates D1 databases, KV namespaces, R2 buckets, Queues, and Vectorize indexes in one command.

## D1 Database (SQLite at the Edge)

Stores trade history, positions, balances, and system logs.

```bash
# List databases
hoox infra d1 list

# Create a database
hoox infra d1 create my-database

# Delete a database
hoox infra d1 delete my-database
```

> **What is D1?** A SQLite database that lives at the network edge. Queries complete in milliseconds because your data is close to your workers. See [Cloudflare Services](../concepts/cloudflare-services.md).

## KV Namespace (Global Config Store)

Holds runtime settings like kill switch state, API routing rules, and rate limiter data.

```bash
# List namespaces
hoox infra kv list

# Create a namespace
hoox infra kv create CONFIG_KV
```

> **What is KV?** A global key-value store that propagates worldwide in seconds. Perfect for settings that change without redeploying.

## R2 Buckets (Object Storage)

Holds trade reports, system logs, and user uploads.

```bash
# List buckets
hoox infra r2 list

# Create a bucket
hoox infra r2 create trade-reports
```

> **What is R2?** S3-compatible storage with zero egress fees. Download as much as you want — no bandwidth charges.

## Queues (Async Messaging)

Reliable message delivery between workers. If an exchange API is down, the queue retries with backoff.

```bash
# List queues
hoox infra queues list

# Create a queue
hoox infra queues create trade-execution
```

## Vectorize (Vector Database)

Powers the Telegram bot's memory — lets it recall past conversations and trades.

```bash
# List indexes
hoox infra vectorize list

# Create an index
hoox infra vectorize create my-rag-index
```

## Next Steps

- [Database Operations](database-ops.md) — Query and manage your D1 data
- [Cloudflare Services Explained](../concepts/cloudflare-services.md) — Deep dive into each service
