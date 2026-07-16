# Private Fabric: Service Bindings as Zero-Trust RPC

_Sources: `papers/sections/03-architecture.tex`, `docs/devops/architecture/bindings.mdx` / `communication.mdx`, shared `serviceFetch` listings._

---

## Thesis

Traditional microservices pay DNS, TCP, TLS, and a public IP surface every time they gossip. HOOX internal workers do not “call each other over the internet.” They call **`binding.fetch("http://internal/path")`**—Cloudflare Service Bindings as an **in-fabric RPC bus**.

Measured overhead: on the order of **~0.4–1 ms**. That is not a second hop across the public internet; that is the private fabric doing its job.

---

## 1. What a binding is

Wrangler declares named peers; runtime code uses the binding object, not a hostname. **`trade-worker` and `d1-worker` have no public trading endpoints** for private work. If you are not in the binding graph, you are not a caller. Topology _is_ the allow-list.

---

## 2. `serviceFetch` contract

Shared helper across the monorepo:

- Address: `http://internal{path}`
- Header: **`X-Internal-Auth-Key`**
- Timeout: **30 s** `AbortSignal`
- Middleware: **`requireInternalAuth`** — unset/missing/mismatch → **401 fail-closed**

Security tests assert the fail-closed cases. Politeness is not a security control.

---

## 3. Topology as product

```text
hoox ──► trade-worker ──► d1-worker
  │           ├── telegram-worker
  │           └── analytics-worker
  ├── telegram-worker
  └── analytics-worker

agent-worker ──► d1 / trade / telegram / analytics
dashboard   ──► d1 / agent / web3-wallet
```

**`analytics-worker` is a fan-in leaf**—many writers, no money-path cycles. Observability graphs that form rings are how distributed systems invent deadlocks of the soul.

---

## 4. Queue as the binding’s twin

| Path                    | Role                             |
| ----------------------- | -------------------------------- |
| Service Binding         | Happy path, sub-ms fabric        |
| `trade-execution` queue | Honest path when happiness fails |

Consumer: platform retries + application backoff **[0, 30, 60, 300, 900] s**, DLQ + D1/Telegram on permanent failure. Mode is **KV-runtime** (`queue_disabled` | `queue_failover` | `queue_everywhere`); default **`queue_failover`**. Paper: during exchange maintenance, queued signals eventually succeed in **99.97%** of cases within five minutes in the evaluated window—latency traded for survival.

---

## 5. Zero trust without a sidecar zoo

NIST-style zero trust often implies mTLS meshes and control planes. HOOX’s edge equivalent:

1. No public routes on internal workers
2. Binding-only reachability
3. Shared secret header, constant-time compare
4. Gateway as the primary trade public door

No Envoy. No east–west certificate ceremony. A wrangler graph and middleware that refuses to be polite when credentials are wrong.

Enterprise extends this with tenant claims and optional mTLS to partners ([essay 13](./13-enterprise-upcoming.md))—same philosophy, thicker rings.

**Previous:** [Idempotency mutex](./04-idempotency-mutex.md) · **Next:** [Smart Placement & latency](./06-smart-placement-latency.md)
