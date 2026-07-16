# 330 Cities, One Decision: PoPs and Smart Placement

_Sources: `papers/sections/04-mechanisms.tex`, `02-background.tex`, `14-runtime-semantics.tex`, ADR notes, listing `wrangler-hoox-placement.jsonc`, edge-architecture docs._

---

## Thesis

Trading latency is mostly geography wearing a software costume. HOOX does not rent a rack next to a matching engine. It runs on **300+ Cloudflare PoPs** and lets **Smart Placement** move compute toward the _outbound_ dependency that dominates order time: the exchange REST API.

Hop budgets and measurement honesty: [essay 06](./06-smart-placement-latency.md).

---

## 1. What a PoP is (HOOX terms)

A **Point of Presence** is where anycast lands public traffic, V8 isolates execute, Service Bindings ride the private fabric, and outbound `fetch` leaves toward exchange origins. Cold starts: **sub-3 ms** class. A PoP is **not** exchange co-lo—it is the best-peered Cloudflare city for _your_ signing code’s HTTPS to the venue.

---

## 2. Three notions of “nearest”

| Question                          | Nearest means                            | HOOX choice             |
| --------------------------------- | ---------------------------------------- | ----------------------- |
| Webhook entry?                    | PoP near TradingView (anycast)           | Free with global edge   |
| Where should `trade-worker` run?  | PoP with best RTT to **exchange origin** | **Smart Placement on**  |
| Where should `dashboard` SSR run? | PoP near **browsers**                    | **Smart Placement off** |

Ingress optimizes stage 1. Placement optimizes the **signed outbound** leg.

---

## 3. Smart Placement mechanism

> Cloudflare continuously measures RTT from PoPs to a Worker’s **outbound origins** and migrates isolate execution to minimize that RTT.

```jsonc
"placement": { "mode": "smart" }
```

Enabled: `hoox`, `trade-worker`, `d1-worker`, `agent-worker`.  
Disabled: `dashboard`.

Invocation/migration cost is lifecycle-class; for a stream of signals, **marginal cost is the optimized outbound leg**. Peering to venues can land in **single-digit milliseconds** when the network cooperates.

---

## 4. Bindings across PoPs

Fear: `hoox` in London, `trade-worker` near Frankfurt-peered Bybit—is the mesh slow?

Answer: Service Bindings use the **private fabric**, not the public internet—still **sub-millisecond** across PoPs. The split is intentional:

```text
TV ──anycast──► PoP_A (hoox)
                  │ private fabric
                  ▼
               PoP_B (trade-worker, smart-placed)
                  │ short public HTTPS
                  ▼
               Exchange API
```

---

## 5. PoP vs VPS

| Fixed VPS                 | Edge + Smart Placement                       |
| ------------------------- | -------------------------------------------- |
| One region forever        | 300+ PoPs; compute migrates                  |
| Outbound 80–200 ms common | Outbound optimized toward venue peering      |
| You pick the city         | Platform measures origins continuously       |
| Idle always on            | Pay-per-request; free tier viable for retail |

Production headline: **~22 ms median** signal-to-ack (direct path)—Smart Placement is a core ingredient of the outbound story, not a checkbox.

---

## 6. Myths

| Myth                                    | Reality                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| Every request runs in all 330 cities    | Placement, not global fan-out of business logic           |
| Ingress PoP always equals execution PoP | Anycast and smart placement can diverge                   |
| Placement replaces WS amortization      | Complementary ([essay 11](./11-exchange-websocket-do.md)) |
| Dashboard should smart-place            | HOOX **disables** it                                      |

**Related:** [Latency race](./06-smart-placement-latency.md) · [Bindings](./05-service-bindings-fabric.md) · [Edge thesis](./01-edge-native-trading.md) · [Enterprise](./13-enterprise-upcoming.md)
