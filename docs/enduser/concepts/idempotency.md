---
title: "Idempotency"
description: "How Durable Objects prevent duplicate trades"
---

# Idempotency

## The Problem

What happens if your internet connection cuts out right after sending a webhook, but the exchange received the order?

Without idempotency, your system might:

1. Think the webhook failed (because you got no response)
2. Retry the request
3. Execute the same trade twice

## The Hoox Solution

Hoox uses **Durable Objects** — Cloudflare's single-threaded server primitive — to track every incoming webhook by its unique ID.

When a webhook arrives:

1. The gateway generates or reads a unique trace ID from the request
2. Before processing, it checks the Durable Object: "Have I seen this ID before?"
3. If seen — the request is silently dropped
4. If new — the request is processed and the ID is stored

## What This Means for You

- **No duplicate trades** — Even if TradingView retries a webhook
- **No manual dedup logic** — It's built into the gateway
- **Automatic cleanup** — Old IDs expire after a configurable TTL

> **Deep dive:** [Durable Objects migration](../devops/setup_and_operations.md#67-durable-objects-migration)
