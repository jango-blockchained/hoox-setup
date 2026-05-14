---
title: "Cloudflare Services Explained"
description: "D1, KV, R2, Queues, Vectorize, Durable Objects in plain English"
---

# Cloudflare Services Explained

Hoox uses several Cloudflare services under the hood. Here's what each one does in plain English.

## D1 (Edge Database)

**What it is:** A SQLite database that lives at the network edge.

**What Hoox uses it for:** Storing trade history, positions, balances, and system logs.

**Why it matters:** Queries complete in milliseconds because your data is as close to your workers as possible. No need to manage a separate database server.

→ [Database Operations Guide](../guides/database-ops.md)

## KV (Key-Value Store)

**What it is:** A global key-value store that propagates updates worldwide in seconds.

**What Hoox uses it for:** Runtime settings — kill switch state, exchange routing rules, rate limiter data.

**Why it matters:** You can change settings without redeploying. Flip the kill switch from any terminal and it takes effect globally within seconds.

→ [Configuration Guide](../getting-started/configuration.md)

## R2 (Object Storage)

**What it is:** S3-compatible storage with zero egress fees.

**What Hoox uses it for:** Trade reports, system logs, user uploads, PDF reports.

**Why it matters:** You can download as much data as you want without bandwidth charges.

## Queues (Async Messaging)

**What it is:** Reliable message delivery between workers with automatic retry.

**What Hoox uses it for:** Trade execution queue — if an exchange API is down, the queue retries with backoff (starting at 30 seconds, up to 15 minutes).

**Why it matters:** Trades don't get lost during exchange API outages or network partitions.

## Vectorize (Vector Database)

**What it is:** A database for AI-powered search and retrieval.

**What Hoox uses it for:** Powers the Telegram bot's memory — it can recall past conversations and trades for context-aware responses.

## Durable Objects

**What it is:** Tiny single-threaded servers that maintain state.

**What Hoox uses it for:** Idempotency — ensuring every webhook is processed exactly once, even if it arrives twice due to a network retry.

**Why it matters:** Prevents duplicate trades without you having to think about it.

→ [Idempotency](idempotency.md)

> **Deep dive:** [Infrastructure Bindings](../devops/bindings.md) | [Storage Architecture](../devops/storages.md)
