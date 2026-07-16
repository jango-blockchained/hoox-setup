# Seven Stages of a Signal: From Webhook to Fill

_Sources: `papers/sections/03-architecture.tex`, `04-mechanisms.tex`, `docs/devops/architecture/data-flow.mdx`._

---

## Thesis

A TradingView alert is a rumor until the exchange acknowledges an order. HOOX formalizes that journey as a **seven-stage signal lifecycle**—shared vocabulary for the academic architecture section, Mermaid sequences in devops docs, and 03:00 incident narratives.

If you cannot name the stage that failed, you are debugging folklore.

---

## The lifecycle

### Stage 1 — Ingestion

`POST /webhook` arrives at **`hoox`** after WAF filtering. Bodies **&gt;100 KB** die before JSON parsing: memory bound and JSON-bomb defense on the primary public trade surface.

### Stage 2 — Validation

Parallel pre-flight (`Promise.all` on the hot path):

- Global **kill switch** (`trade:kill_switch` in CONFIG_KV)
- **IP allow-list** (TradingView CIDRs, KV-extensible)
- **API key** via `timingSafeEqual`

Then session creation, **10 trades / 60 s** rate limit, Zod schema validation. Failures are **fail-closed** (401 / 403 / 429 / 503)—no downstream isolate woken for poison.

### Stage 3 — Idempotency

Composite key approximately:

```text
trade:{exchange}:{symbol}:{action}:{quantity}
```

Checked against **`IdempotencyStore`** (Durable Object). Within TTL (default **300 s**), duplicates are rejected. Semantics: **at-most-once acceptance at the gateway**, not formal exactly-once across queues and venues ([essay 04](./04-idempotency-mutex.md)).

### Stage 4 — Routing

Queue mode (CONFIG_KV, 60 s isolate cache):

| Mode               | Behavior                                           | HTTP “success” means       |
| ------------------ | -------------------------------------------------- | -------------------------- |
| `queue_disabled`   | Always Service Binding                             | Exchange ack on path       |
| `queue_failover`   | **Default** — direct first; queue if binding fails | Ack or enqueue status      |
| `queue_everywhere` | Always enqueue                                     | HTTP success _before_ fill |

### Stage 5 — Execution

**`trade-worker`**: resolve exchange (payload + KV routing), risk gates, place order.

- **REST** default: HMAC-SHA256 via `crypto.subtle`
- Optional **WebSocket amortization** via `ExchangeConnectionManager` when `use_websocket` ([essay 11](./11-exchange-websocket-do.md))

CEXes in core path: **Binance, Bybit, MEXC**.

### Stage 6 — Persistence & notification

Writes through **`d1-worker`**; bulk payloads to **R2**; Telegram and analytics via **non-blocking** `waitUntil` / bindings so chat APIs never hold the fill hostage.

### Stage 7 — Risk management (async)

Every five minutes, **`agent-worker`**: positions, marks, trailing stops, take-profit scale-out, drawdown kill switch, multi-provider LLM summaries ([essay 07](./07-autonomous-risk-manager.md)). Cron is intentionally simple; event-driven risk on the WS connection manager is future/Enterprise work.

---

## Probe mode

`probe: true` short-circuits before exchange validation—enabling `hoox perf fastpath` to separate **internal mesh latency** from **production signal-to-ack** ([essay 06](./06-smart-placement-latency.md)). Measurement without side effects is a first-class design requirement, not a debug hack.

---

## Sequence sketch

```text
TV → WAF → hoox → Idempotency DO → trade-worker → CEX
                      │                 ├─ d1-worker
                      │                 ├─ telegram-worker
                      │                 └─ analytics-worker
                      └─(queue)── trade-execution → consumer
```

**Previous:** [Ten isolates](./02-ten-isolates.md) · **Next:** [Idempotency mutex](./04-idempotency-mutex.md)
