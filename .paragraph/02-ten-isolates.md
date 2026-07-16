# The Ten Isolates: Anatomy of the HOOX Worker Mesh

_Sources: `papers/sections/03-architecture.tex`, `DESIGN.md`, `docs/devops/architecture/overview.mdx`, project-intelligence worker maps._

---

## Thesis

HOOX does not ship a monolith with feature flags. It ships a **small federation of V8 isolates**—each with a single job and a hard boundary. Only two workers expose meaningful public surface. The rest exist solely as **Service Binding targets**: no DNS name you can nmap, no TLS handshake for scanners, no “temporary public debug port.”

Call it microservices if you must. Call it **edge-native decomposition** if you prefer the paper’s vocabulary. The engineering claim is the same: **blast radius and placement are first-class**.

---

## 1. Catalog

| Worker                   | Role                      | Public? | Trigger                       |
| ------------------------ | ------------------------- | ------- | ----------------------------- |
| **`hoox`**               | Gateway & firewall        | Yes     | Webhook / API                 |
| **`trade-worker`**       | Multi-exchange execution  | No      | Binding / Queue               |
| **`agent-worker`**       | AI risk manager           | No      | Cron `*/5 * * * *`            |
| **`telegram-worker`**    | Alerts & RAG copilot      | No      | Binding                       |
| **`d1-worker`**          | Centralized SQLite access | No      | Binding                       |
| **`email-worker`**       | Mailgun / email signals   | Ingress | Cron + webhook                |
| **`web3-wallet-worker`** | DeFi / on-chain           | No      | Binding                       |
| **`analytics-worker`**   | Time-series observability | No      | Binding (fan-in)              |
| **`report-worker`**      | PDF compliance reports    | No      | Cron (e.g. 08:00 & 18:00 UTC) |
| **`dashboard`**          | Next.js 16 command center | Yes     | Browser                       |

**Outside the core production mesh:** `pine-worker` / `pyne-worker` (Pine tooling)—present in the monorepo, excluded from the paper’s ten-worker table of the trading pipeline.

---

## 2. Gateway pattern

```text
Public world → WAF → hoox ──SB──► trade-worker ──► d1 / telegram / analytics
                    ├──SB──► telegram-worker
                    └──SB──► analytics-worker
```

**Rules of the mesh:**

1. **Gateway pattern** — trade signals enter through controlled ingress (`hoox`, email channel). Execution and SQL are not public URLs.
2. **D1 centralization** — business SQL through `d1-worker`, not N raw D1 bindings.
3. **Analytics fan-in** — many writers, one sink; metrics must not own the money path.
4. **Queue failover** — `hoox` produces; `trade-worker` consumes; DLQ for permanent failure.
5. **Idempotency at the door** — `IdempotencyStore` DO lives with the gateway ([essay 04](./04-idempotency-mutex.md)).

---

## 3. Primary binding graph

| Source         | Targets                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `hoox`         | `trade-worker`, `telegram-worker`, `analytics-worker`, `web3-wallet-worker` |
| `trade-worker` | `d1-worker`, `telegram-worker`, `analytics-worker`                          |
| `agent-worker` | `d1-worker`, `trade-worker`, `telegram-worker`, `analytics-worker`          |
| `dashboard`    | `d1-worker`, `agent-worker`, `web3-wallet-worker`                           |

Every binding call carries **`X-Internal-Auth-Key`**, validated by shared middleware—**fail-closed** if missing or wrong. Trust is not “we share a Cloudflare account”; trust is **cryptographic comparison on every hop**.

---

## 4. Why specialization wins at the edge

Isolates are cheap to start and expensive to bloat. Splitting concerns buys:

- **Independent Smart Placement** — `trade-worker` migrates toward exchange RTT; `dashboard` stays near humans and **disables** smart placement.
- **Independent deploy risk** — PDF rendering does not redeploy HMAC signing.
- **Attack surface collapse** — public dashboard compromise ≠ automatic access to exchange secrets on a co-located process.
- **Operable vocabulary** — CLI, docs (`docs/devops/workers/*`), and paper deep-dives speak one worker at a time.

---

## 5. The silent twelfth peer: `@hoox/shared`

Router with `:param` paths, `Errors.*`, exchange provider factory, rate limiting, `serviceFetch`, Zod validation, security headers, queue helpers—**one package, ten isolates**. Consistency without copy-paste is not glamorous; it is how meshes avoid becoming folklore.

---

## 6. Open core, same ten minds

Enterprise HOOX ([essay 13](./13-enterprise-upcoming.md)) does not discard this map. It layers Workers for Platforms, Workflows, and compliance on the **same mental model**. The open core remains the reference architecture; the commercial layer is an extension vector, not a rewrite.

**Previous:** [Edge-native trading](./01-edge-native-trading.md) · **Next:** [Seven-stage signal](./03-seven-stage-signal.md)
