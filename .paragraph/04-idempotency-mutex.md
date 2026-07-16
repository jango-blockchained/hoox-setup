# The Mutex at the Door: Durable Object Idempotency

_Sources: `papers/sections/04-mechanisms.tex`, threat-model appendix notes, `docs/enduser/concepts/idempotency.mdx`._

---

## Thesis

Webhook platforms retry. Networks drop acks. In trading, “please try again” is how double positions are born. HOOX’s answer is not a hopeful KV flag: it is a **Durable Object mutex**—single-threaded execution, SQLite-backed storage, atomic check-and-store under `blockConcurrencyWhile`.

**Claim (precise):** at-most-once _acceptance_ at the gateway within TTL.  
**Non-claim:** formal exactly-once across Queues (at-least-once) and exchange APIs.

---

## 1. The double-fill story

Without dedup: fill succeeds, response lost, client retries, **second fill**.  
With the DO: second attempt collides on the composite key inside the TTL and is rejected (e.g. **409**).

---

## 2. Algorithm (paper Algorithm 1)

```text
Input:  key k, TTL τ
Output: true if new; false if duplicate

enter blockConcurrencyWhile
  e ← storage.get(k)
  if e ≠ null and (now − e.storedAt) < τ then
    return false
  storage.put(k, { storedAt: now })
  schedule alarm at now + τ
  return true
```

Default TTL **300 s**. Alarms reclaim storage so the object is not an infinite ledger of every trade ever attempted.

---

## 3. Key granularity — deliberate trade-off

Key shape:

```text
trade:{exchange}:{symbol}:{action}:{quantity}
```

Excludes free-form `requestId` and timestamp. Two _legitimate_ identical tickets inside the window are treated as one—**retry safety over rapid scale-in**. Design around the TTL if you need burst identical size-ins; do not design around accidental double webhooks.

---

## 4. Fail-open vs fail-closed (the load-bearing asymmetry)

| Concern                    | Posture         | Rationale                                         |
| -------------------------- | --------------- | ------------------------------------------------- |
| Authentication             | **Fail closed** | Forged trade is catastrophic                      |
| Idempotency DO unavailable | **Fail open**   | Possible duplicate recoverable; frozen market not |

Documented in the threat model; tested; not an accident. Production rule from the paper’s engineering patterns:

> **Authentication fails closed; deduplication fails open.**

---

## 5. Why DO, not KV

KV is brilliant for config and rate windows—**eventual** consistency. Wrong tool for “exactly one of two concurrent POSTs may proceed.” Durable Objects give strong consistency for one key space, no get/put interleaving under concurrency, and alarms without a janitor worker.

Planned evolution: exchange-native client order ids (`newClientOrderId` / `orderLinkId`) derived from `requestId`—venue-side cooperation beyond gateway TTL.

**Sister object:** `ExchangeConnectionManager` amortizes WebSockets; it is **not** the idempotency path ([essay 11](./11-exchange-websocket-do.md)).

**Previous:** [Seven-stage signal](./03-seven-stage-signal.md) · **Next:** [Service Bindings fabric](./05-service-bindings-fabric.md)
