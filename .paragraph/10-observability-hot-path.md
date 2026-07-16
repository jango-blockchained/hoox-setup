# See Everything, Block Nothing: Observability on the Hot Path

_Sources: `papers/sections/07-evaluation.tex`, data-flow docs, analytics-worker, CLI perf tooling._

---

## Thesis

A trading system that cannot explain its own latency invents mythology. HOOX’s rule is simpler: **measure every hop that matters; never make the order wait for the metric.**

Enterprise upgrades this plane into regulator-grade Logpush audit ([essay 13](./13-enterprise-upcoming.md)) without reversing the non-blocking contract.

---

## 1. Non-blocking contract

```text
return response
// parallel:
ctx.waitUntil(trackAnalytics(...))
```

`analytics-worker` appends **blobs** (service, endpoint) and **doubles** (latency ms, status) to Analytics Engine (`hoox-analytics`). If metrics lag under extreme load, the fill still happened. Priority order is non-negotiable.

---

## 2. Fan-in topology

Fed by `hoox`, `trade-worker`, `d1-worker`, `telegram-worker`, `email-worker`, `web3-wallet-worker` (and related agent paths). Analytics is a **sink**, not a router of money. Cycles in observability graphs are how you get distributed deadlocks of the soul.

---

## 3. Two clocks, one story

| Clock      | What                                     | Tool                                   |
| ---------- | ---------------------------------------- | -------------------------------------- |
| Synthetic  | Preflight + DO + binding + short-circuit | `hoox perf fastpath`, `probe_id` hops  |
| Production | Gateway receipt → parsed exchange ack    | Analytics Engine `/track`-style events |

Extended: **`hoox trace`** reconstructs journeys when hop logs and indexes align. Integration tests assert probes leave **no D1 side effects**.

---

## 4. Load tests as regression fences

k6 under `tests/load/`: webhook, D1 batches, agent endpoints. Default thresholds (e.g. webhook p95 &lt; 2000 ms under 50 VUs) are **regression fences**, not marketing SLAs. Nightly CI archives JSON so “it got slower last Tuesday” is a file, not a feeling.

---

## 5. Human-time observability

**`report-worker`:** Browser Rendering → PDF → R2 → Telegram (compliance narrative, not hot path).  
**`agent-worker`:** `system_logs` → natural language digests.  
**`dashboard`:** Next.js 16 / OpenNext; Smart Placement off; binds to d1/agent for command center UX.

---

## Series close (open core arc)

1. Edge-native rejection of the fixed VPS
2. Ten-isolate zero-trust mesh
3. Seven-stage signal lifecycle
4. Durable Object mutex (honest fail-open)
5. Service Binding fabric + queue twin
6. Smart Placement + latency taxonomy
7. Cron risk brain + kill switch
8. Multi-tier storage
9. Five security layers
10. Observability that refuses to steal milliseconds

**Also:** [WebSocket DO](./11-exchange-websocket-do.md) · [PoPs](./12-pop-and-smart-placement.md) · [Enterprise](./13-enterprise-upcoming.md)

**Start:** [Edge-native trading](./01-edge-native-trading.md) · **Avatar:** [hoox-avatar.png](./hoox-avatar.png)
