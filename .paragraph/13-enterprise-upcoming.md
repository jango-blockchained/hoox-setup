# HOOX Enterprise: The Institutional Edge (Design Phase)

_A design-phase monograph on the commercial layer. Grounded in `docs/enterprise/_`, `OPEN_CORE.md`, `OPEN_CORE_FEATURE_SPLIT.md`, and `papers/hoox-enterprise-architecture-note.md`. Implementation is incremental and closed-source; architecture is public by design.\*

---

## Abstract

HOOX’s open core already demonstrates that a complete algorithmic trading control plane can run as ten cooperating Cloudflare Workers with Service Bindings, Durable Object mutexes, Smart Placement, and free-tier-viable storage. **HOOX Enterprise** does not abandon that thesis. It _amplifies_ it: multi-tenant isolation via Workers for Platforms, durable multi-step execution via Workflows, regulator-grade immutable audit via Logpush and R2, an extended security surface (Bot Management, API Shield, Zero Trust), hibernatable real-time exchange connectivity, and institutional AI scale through AI Gateway.

**Status (2026):** proposed / in design. Retail and self-hosted users keep the open core. Prop shops, funds, and platforms get a commercial layer with SLAs, tenancy, and compliance—still “no servers, everything at the edge.”

---

## 1. Why Enterprise exists

The open core optimizes for a ruthless question: _can one operator run a serious edge trading stack without a platform team?_ Enterprise optimizes for a different ruthless question: _can many tenants, many strategy books, and many auditors share the same philosophy without sharing each other’s risk?_

| Dimension                     | Open core (today)                     | Enterprise (upcoming)                                      |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Tenancy                       | Single-tenant / self-hosted           | Multi-tenant SaaS or dedicated Ent account                 |
| Durability of multi-step work | Queues + cron + DO                    | **Workflows** (hours/days, step state, human gates)        |
| Audit                         | Analytics Engine + R2 logs (concepts) | **Logpush → R2/SIEM**, Tail Workers, long retention        |
| Security rings                | Five-layer model                      | Layers **0–5+** (Bot Mgmt, API Shield, Access, AI Gateway) |
| Real-time                     | REST default; optional WS DO          | **Hibernatable WS**, event-driven risk beside cron         |
| AI                            | Workers AI + basic RAG                | **AI Gateway**, cost control, proprietary risk models      |
| Support                       | Community / self                      | Commercial SLAs, runbooks, higher limits                   |

The academic paper remains a document of the **open core**. Enterprise architecture docs are published publicly for transparency and credibility; proprietary code is not.

---

## 2. Non-negotiable invariants

Enterprise must not reintroduce the VPS mental model. Design constraints:

1. **Edge-native composition** — Service Bindings, DOs, Smart Placement remain the mesh substrate.
2. **Evolutionary, not forked-from-scratch** — existing workers become templates, system services, or dispatchable components.
3. **Isolation before convenience** — tenant leakage fails closed at dispatch and binding auth.
4. **Audit by default** — security-relevant events are immutable appends, not best-effort `console.log`.
5. **Open core stays useful** — institutions may run dedicated deployments; individuals must not be degraded.

If a feature needs a long-lived regional VM to “just make Workflows work,” it fails the vision test.

---

## 3. Workers for Platforms: multi-tenancy as a first-class topology

### 3.1 Why WfP

Cloudflare **Workers for Platforms (WfP)** provides:

- Isolated **User Workers** per tenant / fund / strategy book
- A central **Dispatch Worker** for routing and auth
- Namespaces, tags (metering, billing, quotas)
- Per-tenant or namespaced bindings (DOs, Queues, D1, R2 paths)
- Recent platform improvements (2025–2026): dashboard management for namespaces/dispatch/tags, static assets on User Workers, **synchronous first deploy** (ready when HTTP 200)

This is the institutional answer to “run HOOX as a platform,” not merely “run HOOX twice.”

### 3.2 Dispatch topology

```text
Public ingress (WAF + Bot Management + API Shield)
        │
        ▼
Dispatch Worker  ── resolve tenant (subdomain | header | JWT)
        │            Zero Trust / rate / bot score
        │            env.TENANT_DISPATCHER.dispatch(...)
        ▼
User Worker (tenant / strategy isolate)
        │
        ├── Service Bindings → system services (tenant-scoped auth)
        ├── DOs: idFromName(`tenant:${id}:…`)
        ├── Queues / D1 / R2 / Vectorize (partitioned)
        └── optional lightweight HOOX mesh per tenant
```

### 3.3 Isolation primitives

| Resource        | Isolation pattern                                           |
| --------------- | ----------------------------------------------------------- |
| Durable Objects | `tenant:${tenantId}:idempotency` or dedicated namespaces    |
| Queues          | Per-tenant or heavily tagged                                |
| D1              | **DB-per-tenant** preferred; else `tenant_id` + hard checks |
| R2              | `tenants/${tenantId}/…` or separate buckets for residency   |
| KV              | Namespaced prefixes                                         |
| Secrets         | Per-script / Secret Store scoped                            |
| Vectorize       | Metadata filter by tenant or separate indexes               |

Auth evolves from `requireInternalAuth` to **tenant-claim-aware** checks (`X-Tenant-Id` must match resolved tenant—mismatch → 403).

### 3.4 Hosted SaaS vs dedicated

- **Hosted SaaS:** one Enterprise Cloudflare account; customers get namespaces + User Workers; billing via tags + external metering.
- **Dedicated:** customer’s own Enterprise account; HOOX templates + CLI; may use Workflows/Logpush/limits **without** full multi-tenant SaaS.

Both share the same architectural DNA as the open core mesh.

---

## 4. Workflows: durable execution for money that takes more than one hop

Retail HOOX is excellent at **short paths** (webhook → bind → fill). Institutions need **long paths** that survive restarts, wait for humans, and reconcile overnight.

**Cloudflare Workflows** supply step-level persistence, automatic retries, pause-for-external-events, and (with Agent integration) real-time hooks.

### 4.1 Canonical workflow catalog (design)

| Workflow                    | Purpose                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `TradeLifecycleWorkflow`    | validate → pre-risk → execute (retries) → persist → post-risk → notify → reconcile |
| `KillSwitchFlattenWorkflow` | durable kill activation + position flattening that **must complete**               |
| `ReconciliationWorkflow`    | daily D1 vs exchange (API and/or Browser Rendering); flag deltas                   |
| `ComplianceReportWorkflow`  | pull R2 audit + D1 → signed PDF → R2 + notify                                      |

Workflows call existing system services via Service Bindings. They do not replace `trade-worker`; they **orchestrate** it when “fire and forget” is ethically insufficient.

### 4.2 Semantics vs open-core queues

| Mechanism | Strength                                     | Enterprise role                       |
| --------- | -------------------------------------------- | ------------------------------------- |
| Queues    | At-least-once delivery, backoff, DLQ         | High-throughput ingress decoupling    |
| Workflows | Multi-step state, human gates, long duration | Compliance, recon, kill sequences     |
| DO mutex  | Single-key serialization                     | Still the short-path idempotency tool |

Exactly-once across all three remains a **composition of guarantees**, not a slogan. Enterprise docs are honest: higher volume + Workflows + venue client order ids push closer to reconstructable uniqueness, not magic.

---

## 5. Observability: from free metrics to regulator-grade audit

Open core already forbids blocking the hot path for metrics ([article 10](./10-observability-hot-path.md)). Enterprise keeps that contract and adds a **compliance plane**.

### 5.1 Pillars

1. **Workers Traces** — cross Service Bindings, DO RPC, Queues, Workflows, external fetch.
2. **Logpush** — Workers Trace Events, HTTP, WAF, Queue, … → **R2** or SIEM (Splunk, SentinelOne, …); custom fields; daily partitions; high volume.
3. **Tail Workers** — sample, enrich (`tenant:` tags), redact secrets before storage.
4. **R2 immutable audit** — lifecycle policies, jurisdiction controls, optional object-lock / WORM-like patterns; Event Notifications → Workflows.
5. **Analytics Engine** — still high-cardinality real-time latency/fills, now **tenant-tagged**.
6. **Workflow history** — step outcomes as first-class audit objects.

### 5.2 Events that must never be optional

- Signal ingress (with bot score / WAF decision)
- Auth success and failure
- Idempotency DO outcomes
- Full order placement + exchange responses
- Risk actions (trailing stop, kill switch)
- Config / secret rotation
- Workflow step terminals

**Retention:** often **7+ years** for financial services—R2 economics make this plausible where classical log vendors would not.

### 5.3 Reconstruction thesis

Given `traceId` / `clientOrderId` / Ray ID, an auditor should reconstruct the journey across workers without asking a human to SSH into anything—because there is nothing to SSH into.

---

## 6. Security: concentric rings, enterprise thickness

Open core: five layers ([article 09](./09-five-layer-security.md)). Enterprise **extends** rather than replaces.

| Layer | Enterprise addition                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| **0** | **Bot Management** — scores, verified bots, JA3/JA4, early drop of spoofed signal sources                           |
| **1** | Advanced **WAF** (100+ rate rules, high-cardinality) + **API Shield** (JSON schema, JWT, mTLS, sequence mitigation) |
| **2** | **Zero Trust / Access** on dashboard & mgmt APIs; SCIM; device posture                                              |
| **3** | Internal key **+** tenant claims **+** optional mTLS to partners                                                    |
| **4** | DO / SQLite append-only with hashes; dual-write signatures to D1 + R2                                               |
| **5** | **AI Gateway** guardrails — prompt sanitization, logging, rate limits, cost caps on every LLM decision              |

Kill switch becomes multi-sourced (Access UI, mTLS API, Workflow, AI anomaly) and **every activation is signed and immutable**. Flattening is a Workflow, not a best-effort loop.

### 6.1 New threat classes

- Malicious or buggy **tenant code** → WfP isolation + review gates
- Strategy supply-chain → sandboxing patterns + AI Gateway
- “Prove you didn’t front-run” → full immutable trace + signatures
- Sophisticated bot / credential stuffing on webhooks → Bot Management + WAF

---

## 7. Real-time: hibernatable WebSockets and the end of cron monopoly

Open core already ships `ExchangeConnectionManager` for optional amortized placement ([article 11](./11-exchange-websocket-do.md)). Enterprise pushes the same object class harder:

- **Hibernatable WebSockets** — keep venue connections economically alive while the DO sleeps
- Live fills, partials, and eventually books
- **Event-driven risk** beside (then largely above) the 5-minute `agent-worker` cron
- Workflows consume stream events for durable handling

The paper’s limitation—“risk is cron-simple”—is an open-core honesty statement. Enterprise’s roadmap is the formal response.

---

## 8. AI at institutional scale

| Open core                            | Enterprise                                 |
| ------------------------------------ | ------------------------------------------ |
| Workers AI + multi-provider fallback | **AI Gateway** in front of all providers   |
| Telegram RAG over trades             | Large corpus embeddings, compliance RAG    |
| LLM summaries                        | Proprietary risk models, anomaly detection |
| Basic prompt sanitizer               | Gateway policies + full AI decision audit  |

**Invariant preserved:** models may _advise_ and _summarize_; order placement remains signed code paths with risk gates—not free-form model tool abuse without policy.

---

## 9. Storage, sovereignty, and limits

- **R2 jurisdictions** (EU / US / APAC-only buckets), lifecycle for audit immutability
- **D1** higher storage/throughput; PITR / replicas when available; per-tenant DBs
- **Vectorize / Queues / DO / Browser Rendering** at Enterprise ceilings
- **Hyperdrive** if hybrid historical Postgres enters the picture
- **Custom limit increases** via account team—CPU, memory, subrequests, concurrency, worker count

Smart Placement remains; Enterprise routing/peering can further reduce jitter to exchange regions for dedicated accounts.

Optional exotics (rare but real for some props): **Magic Transit / Spectrum** for private paths to venues or on-prem bridges.

---

## 10. Target topology (one diagram to rule the sales deck)

```text
                    ┌─────────────────────────────────────┐
                    │  Observability plane (always on)    │
                    │  Traces · Logpush · Tail · AE · AI  │
                    └─────────────────────────────────────┘
                                      ▲
Public ──► WAF/Bot/API Shield ──► Dispatch (WfP) ──► User Workers
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              System mesh      Workflows           Storage
           (HOOX services)  (trade/recon/kill)   D1·R2·KV·Vec
                    │                 │                 │
                    └──────── DOs (idempo · WS · risk) ─┘
```

Existing `hoox`, `trade-worker`, `agent-worker`, … become **system templates** or **services** behind dispatch—not discarded folklore.

---

## 11. Open core boundary (so nobody is surprised)

From `OPEN_CORE_FEATURE_SPLIT.md`—selected rows:

| Feature                                         | Open              | Enterprise     |
| ----------------------------------------------- | ----------------- | -------------- |
| 10-worker mesh + bindings                       | Yes               | Uses + extends |
| Full multi-tenant SaaS + billing                | No                | Yes            |
| Production Workflows for trade/recon/compliance | Skeleton/examples | Full           |
| Production Logpush + SIEM + immutable audit     | Concepts/examples | Full           |
| Proprietary risk / anomaly models               | No                | Yes            |
| Hosted control plane + SLAs                     | No                | Yes            |
| Architecture docs for Ent features              | **Public**        | **Public**     |
| Ent implementation code                         | —                 | **Private**    |

This split is not a bait-and-switch; it is how open core remains independently useful while institutions fund the expensive plane.

---

## 12. Migration & coexistence

1. Retail HOOX continues unchanged on free/paid Cloudflare.
2. Enterprise customers choose **hosted** or **dedicated**.
3. Migration is **additive**: enable dispatch, tenant prefixes, Logpush jobs, Workflow definitions; do not require a big-bang rewrite of HMAC clients.
4. CLI/TUI gain Enterprise profiles (templates, namespace bootstrap, audit job wiring)—design goal, not day-zero complete.

**Implementation order (indicative):**  
isolation (WfP + tenant auth) → audit (Logpush/Tail/R2) → Workflows (kill + recon) → hibernatable WS risk → proprietary AI/risk models.

---

## 13. Research questions still open (academic honesty)

Enterprise design is not a finished evaluation paper. Open problems:

1. **End-to-end uniqueness** under Workflows + Queues + venue retries at 10–100× retail volume.
2. **Tenant noisy-neighbor** effects on Smart Placement and DO namespaces.
3. **Audit cost curves** (Logpush volume vs R2 lifecycle) under continuous WS event firehoses.
4. **How much risk can leave cron** without reintroducing dual-control bugs between event path and Workflow path.
5. **Formal threat model** extensions for untrusted User Worker code (WfP) beyond the open-core appendix.

The open core’s strength was measuring what it shipped. Enterprise should inherit that epistemology: ship, measure, publish architecture, keep proprietary only where the business and compliance demand it.

---

## 14. Closing

HOOX Enterprise is the same joke told for larger money: **the control plane is the edge**. Multi-tenancy is Dispatch, not a Kubernetes admission controller. Durability is Workflows, not a hidden database app server. Compliance is Logpush into jurisdiction-aware R2, not a syslog pet. Real-time is hibernatable Durable Object sockets, not a forever-box in `us-east-1`.

The open core remains the citable, runnable proof. Enterprise is the institutional amplifier—**upcoming, designed in public, implemented in private**, and still allergic to servers.

**Related open-core essays:** [Ten isolates](./02-ten-isolates.md) · [Five-layer security](./09-five-layer-security.md) · [Observability](./10-observability-hot-path.md) · [WebSocket DO](./11-exchange-websocket-do.md) · [PoPs & Smart Placement](./12-pop-and-smart-placement.md)

**Primary sources:** `docs/enterprise/architecture.mdx`, `multi-tenancy.mdx`, `security-compliance.mdx`, `observability-audit.mdx`, `OPEN_CORE*.md`, `papers/hoox-enterprise-architecture-note.md`
