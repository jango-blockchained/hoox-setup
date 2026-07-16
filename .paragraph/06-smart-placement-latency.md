# The Latency Race: Smart Placement and Honest Measurement

_Sources: `papers/sections/04-mechanisms.tex`, `07-evaluation.tex`, root README, `docs/enduser/concepts/edge-architecture.mdx`._

---

## Thesis

Latency claims are easy to oversell and hard to defend. HOOX’s paper spends unusual effort on a **measurement taxonomy** before boasting a median. Architecture is what you build; **epistemology is what you publish**.

Geography deep-dive (PoPs, anycast vs execution placement): [essay 12](./12-pop-and-smart-placement.md).

---

## 1. What actually dominates

For a signed REST order, the heavyweight term is usually **outbound RTT from the isolate to the exchange API**—not “time to reach Cloudflare,” and not Service Binding hops.

A VPS fixed in Virginia talking to Tokyo/Singapore can burn **80–200 ms** on that outbound leg alone. **Smart Placement** attacks that term by migrating isolate execution toward PoPs with excellent measured RTT to outbound origins.

---

## 2. Configuration

```jsonc
"placement": { "mode": "smart" }
```

Latency-sensitive: `hoox`, `trade-worker`, `d1-worker`, `agent-worker`.  
**`dashboard` disables** Smart Placement—browsers are not Binance.

Internal bindings stay **sub-millisecond** even across different PoPs (private fabric).

---

## 3. Measurement taxonomy

| Class           | Scope                                    | Tool                      | Hits exchange? |
| --------------- | ---------------------------------------- | ------------------------- | -------------- |
| Fast-path probe | Preflight + DO + binding + short-circuit | `hoox perf fastpath`      | **No**         |
| Production ack  | Gateway receipt → parsed CEX ack         | Analytics Engine + traces | **Yes**        |
| Load test       | Concurrency / regression                 | k6 `tests/load/`          | Optional       |

Probes: `probe: true`, **N = 200** detailed hops in reported tables.  
Production: **N = 18,742** signals / **N = 16,104** terminal acks (reported window).

### Representative fast-path p50 (synthetic)

| Hop                           | p50         |
| ----------------------------- | ----------- |
| CLI → gateway (network + WAF) | 4.2 ms      |
| Preflight (parallel)          | 1.8 ms      |
| Idempotency DO                | 0.9 ms      |
| Service Binding               | 0.5 ms      |
| trade-worker + short-circuit  | 1.1 ms      |
| **CLI total RTT**             | **17.8 ms** |

Internal mesh after WAF: often **&lt;6 ms p95**. First hop into the edge often dominates probe totals.

---

## 4. Production headline & VPS baseline

**~22 ms median** signal-to-ack on direct path. README hop card: ~4+3+1+14 ms vs ~240 ms illustrative unoptimized VPS path (~11×). Geographic scenarios in end-user docs range roughly **5.6×–40×** vs fixed-region VPS—read as **edge proximity vs unoptimized single region**, not vs exchange co-lo.

---

## 5. WebSocket turbo (optional)

Default remains REST + Smart Placement. For sustained **≥ ~2 orders/s**, KV `use_websocket` + `ExchangeConnectionManager` can drop medians **~22 → ~12–14 ms** on those accounts ([essay 11](./11-exchange-websocket-do.md)).

---

## 6. How not to fool yourself

1. Probe ≠ production ack.
2. VPS baseline is unoptimized single-region.
3. Queue mode changes what “ack” means.
4. Reproducibility tooling is first-class (`hoox perf`, k6, CI artifacts).

**Previous:** [Service Bindings](./05-service-bindings-fabric.md) · **Next:** [Autonomous risk manager](./07-autonomous-risk-manager.md) · **Also:** [PoPs](./12-pop-and-smart-placement.md)
