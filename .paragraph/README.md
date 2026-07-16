# .paragraph — Essays on HOOX Code & Architecture

Long-form writing on the HOOX edge trading system: workers, bindings, latency, security, Durable Objects, PoPs, and the **Enterprise design layer**.

**Voice:** academic-grade precision (theses, caveats, N’s, failure modes) with nerd energy (mesh folklore, load-bearing asymmetries, anti-myth tables). Grounded in `papers/`, `docs/`, and the monorepo—not marketing vapor.

These are essays, not API reference. For operators, prefer `docs/`; for formal claims, prefer `papers/`.

---

## Avatar (official logo mark)

Built from `logo/light.svg` (not AI-generated).

| File                                                 | Use                                     |
| ---------------------------------------------------- | --------------------------------------- |
| [`hoox-avatar.svg`](./hoox-avatar.svg)               | Source: white mark on near-black square |
| [`hoox-avatar.png`](./hoox-avatar.png)               | 1024×1024 PNG (primary profile image)   |
| [`hoox-avatar.jpg`](./hoox-avatar.jpg)               | 1024×1024 JPEG                          |
| [`hoox-avatar-orange.svg`](./hoox-avatar-orange.svg) | White mark on brand orange (`#ff7f2a`)  |
| [`hoox-avatar-orange.png`](./hoox-avatar-orange.png) | Orange-background PNG variant           |

---

## Open-core series

| #   | File                                                             | Theme                               |
| --- | ---------------------------------------------------------------- | ----------------------------------- |
| 01  | [01-edge-native-trading.md](./01-edge-native-trading.md)         | Why HOOX lives at the edge          |
| 02  | [02-ten-isolates.md](./02-ten-isolates.md)                       | The ten-worker mesh                 |
| 03  | [03-seven-stage-signal.md](./03-seven-stage-signal.md)           | Signal lifecycle                    |
| 04  | [04-idempotency-mutex.md](./04-idempotency-mutex.md)             | Durable Object deduplication        |
| 05  | [05-service-bindings-fabric.md](./05-service-bindings-fabric.md) | Zero-trust internal RPC             |
| 06  | [06-smart-placement-latency.md](./06-smart-placement-latency.md) | Latency race & measurement taxonomy |
| 07  | [07-autonomous-risk-manager.md](./07-autonomous-risk-manager.md) | `agent-worker` intelligence         |
| 08  | [08-multi-tier-storage.md](./08-multi-tier-storage.md)           | D1, KV, R2, DO, Vectorize           |
| 09  | [09-five-layer-security.md](./09-five-layer-security.md)         | Concentric security model           |
| 10  | [10-observability-hot-path.md](./10-observability-hot-path.md)   | Metrics without blocking trades     |
| 11  | [11-exchange-websocket-do.md](./11-exchange-websocket-do.md)     | Exchange WebSocket sessions via DO  |
| 12  | [12-pop-and-smart-placement.md](./12-pop-and-smart-placement.md) | PoPs, anycast, Smart Placement      |

## Enterprise (design phase)

| #   | File                                                     | Theme                                                                |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| 13  | [13-enterprise-upcoming.md](./13-enterprise-upcoming.md) | **Big one:** multi-tenancy, Workflows, audit, Ent security, AI scale |

---

## Suggested reading orders

**Latency deep dive:** 01 → 12 → 06 → 11 → 05

**Security deep dive:** 09 → 04 → 05 → 13

**Full arc:** 01 → 02 → 03 → … → 13

---

## Sources

- `papers/sections/` — architecture, mechanisms, security, evaluation, ADRs
- `docs/devops/architecture/` — topology, data flow, storage, bindings
- `docs/enduser/concepts/` — edge model, idempotency, signals
- `docs/enterprise/` — commercial layer design (public docs, private code)
- `OPEN_CORE.md`, `OPEN_CORE_FEATURE_SPLIT.md`
- Root `README.md`, `DESIGN.md`
