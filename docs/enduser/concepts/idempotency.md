---
title: "Idempotency & Durable Objects"
description: "How Hoox utilizes Cloudflare Durable Objects to guarantee exactly-once execution and prevent catastrophic duplicate orders during network dropouts."
---

# 🔒 Idempotency & Durable Objects

In automated financial systems, **execution integrity is everything**. If a network dropout occurs at the exact millisecond after your gateway submits an order to an exchange but before the exchange sends back a confirmation, a standard system faces a dilemma:

- If it assumes the order failed and retries, it risks **executing duplicate trades** (e.g. accidentally buying the same spot position twice, doubling leverage, and exposing your account to high liquidation risks).
- If it assumes the order succeeded and does nothing, it risks **missing critical trade entries**.

Hoox solves this problem natively at the edge gateway layer using **Cloudflare® Durable Objects** to enforce an absolute **exactly-once execution policy** (idempotency).

---

## ⚠️ The Danger: How Webhook Retries Lead to Double-Ordering

Without idempotency, a typical signal failure sequence looks like this:

```
[TradingView Webhook] ─── (Signal Post) ───> [Gateway Node] ─── (Submit Order) ───> [Exchange API]
                                                                                            │
                                                                                    (Order Filled!)
                                                                                            │
[TradingView Webhook] <── (TLS/TCP Dropout) ── [Gateway Node] <── (Send Success) ─── (Connection drops)
         │
(No response: Retries!)
         │
[TradingView Webhook] ─── (Signal Post) ───> [Gateway Node] ─── (Submit Order) ───> [Exchange API]
                                                                                            │
                                                                                   (DOUBLE-FILLED! ❌)
```

---

## 🛡️ The Hoox Solution: Durable Objects Mutex Locking

To enforce exactly-once execution, Hoox implements an **atomic dedup lock** inside `workers/hoox` utilizing **Cloudflare Durable Objects**.

A Durable Object is a unique, single-threaded compute isolate managed by Cloudflare that maintains its own highly optimized, in-memory state and persistent on-disk SQLite storage. Because access to a specific Durable Object instance is single-threaded, it acts as an absolute **distributed lock** (mutex).

### The Idempotency Workflow

```
[Incoming Webhook Payload]
         │
         ▼
[Extract Trace ID / Mutex Key]
         │
         ▼
[Ping Dedicated Durable Object Isolate]
         │
 ┌───────┴──────────────────────────────────────────┐
 │ Single-Threaded Mutex Lock Acquired              │
 │                                                  │
 │ Check local SQLite dedup log:                    │
 │ "Has Trace ID '9b1deb4d...' been seen?"          │
 └───────┬──────────────────────────────────────────┘
         │
         ├─► [YES: Duplicate Detected] ─────────────────────┐
         │                                                 │
         │                                                 ▼
         │                                     [Silent Dropping of Request]
         │                                                 │
         │                                                 ▼
         │                                     [Return 409 Conflict Response]
         │
         └─► [NO: Unique Transaction] ─────────────────────┐
                                                           │
                                                           ▼
                                               [Record ID in SQLite Log]
                                                           │
                                                           ▼
                                               [Process Pipeline Execution]
                                                           │
                                                           ▼
                                               [Set TTL-based DO Alarm]
```

---

## 🔍 The Dedup & Cleanup Algorithm

### 1. Trace ID Generation

When a trade signal is fired, it must include a unique transaction signature.

- For TradingView webhooks, this is automatically generated as a combination of alert parameters and timestamps.
- If a client does not supply a transaction ID, the Hoox Gateway dynamically hashes the symbol, exchange, action, and timestamp to create a unique **Idempotency Key**.

---

### 2. Atomic Evaluation

Before executing any order routing:

1. The gateway routes the request to the namespace-mapped Durable Object using the transaction ID as the binding key.
2. The Durable Object checks its internal state. Since DOs are single-threaded, there is **zero risk of race conditions**—if two identical HTTP requests hit Cloudflare simultaneously, they are processed sequentially inside the DO.
3. If the ID exists in the DO's SQLite log, the DO immediately intercepts the request and throws a `409 Conflict` exception, stopping the pipeline before hitting exchange APIs.
4. If unique, it registers the ID, saves the current timestamp, and returns a lock approval.

---

### 3. Automatic TTL & Storage Alarms

To prevent the Durable Object's persistent storage from growing indefinitely and consuming unnecessary memory:

- The DO registers an **atomic alarm** scheduled for 24 hours in the future.
- When the alarm fires, the DO runs an automatic garbage collection script that purges old IDs from its local storage.
- This ensures that while you are 100% protected against duplicates during network dropouts, your storage footprint remains lightweight.

---

> **Warning:** Never disable idempotency check bindings in your `wrangler.jsonc` file in production. The performance cost of pinging the DO is less than **2 milliseconds**, while the cost of a duplicate order could be catastrophic.

### 🔗 Next Steps

- **[Signals & Trade Specifications](signals-and-trades.md)** — Learn how to configure your Pine Script webhook payloads to transmit unique idempotency keys.
- **[Platform Security Guides](../guides/secrets-security.md)** — Deepen your understanding of Zero Trust headers and edge firewall configurations.
