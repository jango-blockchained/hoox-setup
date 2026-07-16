# One Socket Per Venue: Exchange WebSockets over Durable Objects

_Sources: `papers/sections/04-mechanisms.tex` (§WS amortization), `15-advanced-mechanisms.tex`, `14-runtime-semantics.tex`, listings `exchange-connection-do.ts` / `ws-amortization.ts`, `workers/trade-worker/src/exchange-connection-manager.ts`._

---

## Thesis

The default HOOX path is already fast: Smart Placement plus REST yields ~**22 ms** median signal-to-ack. That number still hides a tax. Every REST order pays **TCP + TLS + HTTP**—work that dominates when the same account fires several orders per second into a trend.

HOOX amortizes that cost not with a forever-box, but with a **Durable Object that owns one WebSocket per exchange**: `ExchangeConnectionManager`, gated by CONFIG_KV **`use_websocket`**.

---

## 1. Why a DO, not the isolate heap

Worker isolates are ephemeral. Durable Objects provide stable identity, single-threaded execution, alarms that fire without an active request, and (Enterprise) hibernatable WebSockets. The DO is the correct home for a session that must **outlive** a single `trade-worker` fetch.

---

## 2. Four moving parts

### Name-based sharding

```text
idFromName("exchange:" + exchangeName)
```

Exactly one manager per (account, exchange). Exchange name derived from DO id; `IWsAdapter` from registry; missing creds/adapter → **REST-only** with warning. State: **handles + `pending` map**—not signing secrets.

### Hidden handshake (`waitUntil`)

Cold upgrade costs **50–200 ms**. Constructor: `this.ctx.waitUntil(this.connectToExchange())`. First caller does not block on handshake; if not `ready`, fall through to REST. Inbound messages refresh a **60 s** keep-alive alarm.

### Correlation + 5 s timeout

Adapters build/parse venue envelopes. Correlation: Binance/MEXC `id`, Bybit `reqId`. `pending` map + timer; stuck sockets cannot pin Promises forever. Uncorrelated push events refresh alarms only.

### Alarm-driven reconnect

On close/error: reject all pending, null socket, reconnect **5 s / 10 s**. Alarms survive empty request queues—unlike isolate reconnect loops that die with the request.

---

## 3. Transparent REST fallback

```text
if ready && ws && adapter → try WS
else / on failure → executeTradeRest (same risk gate)
```

Ops canary with a KV flip—no redeploy. Default production remains **REST + Smart Placement**. WS targets sustained **≥ ~2 orders/s**. Observed: those accounts **~22 → ~12–14 ms** medians in the reported window.

---

## 4. Sister DO, different job

| DO                          | Job                                    |
| --------------------------- | -------------------------------------- |
| `IdempotencyStore`          | At-most-once **acceptance** at gateway |
| `ExchangeConnectionManager` | Amortized **placement transport**      |

Confusing them is how you misread the architecture. Event-driven risk on this socket is future/Enterprise work ([essay 13](./13-enterprise-upcoming.md)).

**Related:** [Idempotency](./04-idempotency-mutex.md) · [Latency](./06-smart-placement-latency.md) · [PoPs](./12-pop-and-smart-placement.md) · [Signal lifecycle](./03-seven-stage-signal.md)
