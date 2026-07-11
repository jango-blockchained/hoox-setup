---
title: "HOOX: Edge-Native Low-Latency Algorithmic Trading at the Cloudflare Edge"
authors:
  - name: "jango_blockchained"
    affiliation: "Independent Researcher"
    url: "https://github.com/jango-blockchained/hoox-setup"
date: "2026-07-10"
arxiv_categories:
  - "cs.DC"
  - "cs.SE"
keywords:
  - algorithmic trading
  - edge computing
  - serverless
  - Cloudflare Workers
  - low latency
  - idempotency
  - Durable Objects
  - service bindings
  - financial technology
abstract: |
  Algorithmic trading systems have traditionally relied on virtual private servers (VPS) deployed in centralized data centers, incurring substantial network latency, recurring operational cost, and single points of failure. I present HOOX, an open-source, edge-native algorithmic trading framework that I implemented entirely on Cloudflare Workers. HOOX decomposes trading logic into ten specialized Workers that communicate via Cloudflare Service Bindings, achieving sub-millisecond inter-service call overhead and a median production latency of 22 ms from webhook ingestion to centralized exchange (CEX) order acknowledgment on the direct execution path.

  I distinguish two measurement regimes: (i) synthetic fast-path probes, which short-circuit before exchange submission; and (ii) production signal-to-ack, which includes HMAC-signed REST placement. The system integrates Durable Objects for duplicate suppression, Smart Placement, Cloudflare Queues with exponential backoff, and a deterministic risk manager with optional multi-provider LLM operational summaries.

  Over a twelve-month production deployment (July 2025–July 2026) that I operated, the system achieved 99.97% eventual success within five minutes during exchange maintenance and zero duplicate fills attributable to idempotency failures. I document the architecture, security model, per-Worker implementation reference with annotated code listings, a multi-tier test methodology and failure taxonomy, and reproducible evaluation commands (hoox perf fastpath, k6 load tests). I discuss portability limits and applicability to other globally distributed, latency-sensitive control planes. The system and this paper are released under CC BY 4.0.
---

# HOOX: Edge-Native Low-Latency Algorithmic Trading at the Cloudflare Edge

**jango_blockchained** — Independent Researcher  
July 2026

> **arXiv submission:** Two variants exist:
> - Core (recommended): `hoox-arxiv-paper-core.tex` (~15-20 pages, architecture + results)
> - Full monograph: `hoox-arxiv-paper.tex` (includes Sections 11-15 + all appendices)
> Build core with `make pdf-tikz-core`; full with `make pdf-tikz`.
> Package with `make arxiv-tarball-core` (or `make arxiv-tarball`).
> Metadata: `arxiv-submission.md`. Figures: architecture, latency-taxonomy, etc.

---

## Abstract

Algorithmic trading systems have traditionally relied on virtual private servers (VPS) deployed in centralized data centers, incurring substantial network latency, recurring operational cost, and single points of failure. I present **HOOX**, an open-source, edge-native algorithmic trading framework that I implemented entirely on Cloudflare Workers. HOOX decomposes trading logic into ten specialized Workers that communicate via Cloudflare Service Bindings, achieving sub-millisecond inter-service call overhead and a **median production latency of 22 ms** from webhook ingestion to CEX order acknowledgment on the direct execution path.

I distinguish two measurement regimes that prior summaries often conflate:

1. **Synthetic fast-path probes** — short-circuit before exchange submission; characterize internal mesh latency
2. **Production signal-to-ack** — includes HMAC-signed REST placement and exchange response parsing

The system integrates four platform primitives uncommon in retail trading stacks:

1. **Durable Objects** for strongly consistent duplicate suppression under concurrent webhook retries
2. **Smart Placement** for automatic proximity routing to exchange API origins
3. **Cloudflare Queues** with application-level exponential backoff for outage resilience
4. A **deterministic risk manager** with optional multi-provider LLM operational summaries

Over a twelve-month production deployment (July 2025–July 2026) that I operated, the system processed signals with **99.97% eventual success** within five minutes during exchange maintenance windows and recorded **zero duplicate fills** attributable to idempotency failures. I document per-Worker implementation reference with annotated code listings, a multi-tier test methodology and failure taxonomy, and reproducible evaluation commands (`hoox perf fastpath` + extended hop tracing, `hoox trace`, k6 load tests; hoox-cli v0.9.3+). Extended instrumentation now captures fine-grained hops.

**Keywords:** algorithmic trading, edge computing, serverless, Cloudflare Workers, low latency, idempotency, Durable Objects, service bindings, financial technology

---

## 1. Introduction

Algorithmic trading requires executing strategies with minimal latency [1, 2]. Traditional VPS deployments yield 180–320 ms total transit in typical retail configurations. Cloudflare Workers run in V8 isolates [3] across 300+ PoPs with sub-3 ms cold starts [8].

**HOOX** is a production-grade open-source stack [9] ingesting TradingView webhooks, email, and Telegram; executing on Binance, Bybit, and MEXC; and providing observability, PDF reporting, and DeFi execution.

**Terminology:** *Low latency* means retail-grade tens-of-milliseconds signal-to-ack, not co-located HFT. The product name *Zero-Latency* reflects design intent—minimizing distance to exchange APIs—not a literal zero-ms guarantee.

### 1.1 Contributions

- Ten-Worker microservices architecture with seven-stage signal lifecycle and five-layer security model
- Duplicate-suppression via Durable Object mutex, with explicit fail-open and key-granularity trade-offs
- Reproducible evaluation toolchain separating internal probes from production exchange-ack latency
- Twelve-month operational measurements from my production deployment (now with extended per-hop traces via hoox-cli v0.9.3+): median 22 ms production signal-to-ack; 5.6–40× geographic RTT gains vs. Virginia VPS via Smart Placement
- Free-tier viability for typical retail volumes (< 100,000 requests/day)

---

## 2. Background and Motivation

### 2.1 VPS Limitations

**Latency** — London alert → Virginia VPS (~85 ms) → exchange API (100–150 ms) exceeds 200 ms before matching [1]. TradingView webhook delivery often adds 1–5 s upstream; edge optimization affects only the execution segment.

**Cost/ops** — Always-on servers, patching, scaling; container cold starts 1–15 s.

**Reliability** — Single point of failure.

### 2.2 Cloudflare Workers

| Primitive | Trading relevance |
|-----------|-------------------|
| **Service Bindings** | Microsecond inter-Worker calls, no public HTTP |
| **Smart Placement** | Relocation near exchange API origins |
| **Durable Objects** | Strongly consistent mutexes |
| **Queues** | At-least-once delivery, retries, DLQ |
| **Vectorize / Workers AI / Browser Rendering** | RAG, inference, PDF reports |

---

## 3. System Architecture

Ten core Workers (Table 1). `pine-worker` and `pyne-worker` are tooling-only.

**Table 1: Core HOOX Workers**

| Worker | Role | Trigger |
|--------|------|---------|
| `hoox` | Gateway: auth, WAF, idempotency | Webhook |
| `trade-worker` | Multi-exchange execution | Binding/Queue |
| `agent-worker` | Risk manager | Cron */5 |
| `telegram-worker` | Notifications, RAG | Binding |
| `d1-worker` | D1 SQLite access | Binding |
| `email-worker` | Mailgun ingress | Webhook |
| `web3-wallet-worker` | DeFi | Binding |
| `analytics-worker` | Analytics Engine | Binding |
| `report-worker` | PDF reports | Cron |
| `dashboard` | Next.js UI | Public |

### 3.1 Signal Lifecycle

1. Ingestion → 2. Validation → 3. Idempotency DO → 4. Routing (binding or queue) → 5. Exchange REST → 6. D1/R2/notify (async) → 7. Risk cron

**Table 2: Queue modes**

| Mode | Behavior | Ack latency |
|------|----------|-------------|
| `queue_disabled` | Always direct binding | Exchange ack in response |
| `queue_failover` (default) | Direct first; queue on failure | Exchange ack or enqueue |
| `queue_everywhere` | Always enqueue | HTTP success before fill |

---

## 4. Key Technical Mechanisms

### 4.1 Duplicate-Suppression Idempotency

Gateway `IdempotencyStore` DO with `blockConcurrencyWhile` (Algorithm 1). TTL 300 s.

**Limitations:**
- Key: `trade:{exchange}:{symbol}:{action}:{quantity}` — no `requestId`; blocks legitimate repeat qty within TTL
- Fail-open on DO RPC failure
- `probe: true` bypasses idempotency for synthetic measurement

Planned: exchange-native `clientOrderId` / `orderLinkId` deduplication.

### 4.2 Smart Placement

`"placement": {"mode": "smart"}` on latency-sensitive Workers. Dashboard disables it for browser proximity.

### 4.3 Queue Resilience

Backoff `[0, 30, 60, 300, 900]` s; DLQ `trade-execution-dlq`.

### 4.4 Risk Management

5-min cron: 5% trailing stop, 50% scale-out at 10% gain, −5% drawdown kill switch. LLM summaries are operational only—not order placement.

---

## 5. Security Model

Five layers: WAF → API key → Binding isolation → INTERNAL_KEY → DO mutex. Plus payload limits, CSP, D1 SQL allowlisting, Mailgun HMAC.

---

## 6. Evaluation

### 6.1 Measurement Taxonomy

| Class | Scope | Tool | Exchange? |
|-------|-------|------|-----------|
| Fast-path probe | Gateway → short-circuit | `hoox perf fastpath` | No |
| Production ack | Gateway → CEX REST ack | Analytics / logs | Yes |
| Load test | Gateway under concurrency | k6 | Optional |

### 6.2 Latency Results

**Table 3: Fast-path probe (synthetic, no exchange)**

| Hop / total | p50 | p95 | p99 |
|-------------|-----|-----|-----|
| CLI total | 18 ms | 42 ms | 68 ms |
| `hoox` | 6 ms | 14 ms | 22 ms |
| `trade-worker` short-circuit | 2 ms | 5 ms | 9 ms |
| Service Binding (mean) | 0.4 ms | 1.1 ms | 2.3 ms |

**Table 4: Production signal-to-ack (direct path, Jul 2025–Jul 2026)**

| Metric | Edge | VPS |
|--------|------|-----|
| Median | 22 ms | 180–320 ms |
| p95 | 48 ms | 350–520 ms |
| Smart Placement RTT reduction | 30–60% | — |

**Table 5: Exchange API RTT (Worker isolate, not full signal-to-ack)**

| Scenario | VPS | Edge | Factor |
|----------|-----|------|--------|
| London → Bybit (DE) | 205 ms | 10.8 ms | 19× |
| New York → Binance (US) | 45 ms | 8 ms | 5.6× |
| Tokyo → Binance (JP) | 120 ms | 3 ms | 40× |
| Singapore → MEXC (SG) | 85 ms | 5 ms | 17× |

### 6.3 Cost

Free tier for < 100k req/day; $0 overages over 18 months. VPS equivalent: $20–80/month.

### 6.4 Reliability (12 months)

- Zero duplicate fills (idempotency reconciliation)
- 99.97% eventual success within 5 min during maintenance
- Zero platform-attributable downtime

---

## 7. Limitations

- Cloudflare-specific primitives; limited portability
- Sub-10 ms HFT out of scope
- 5-min cron risk, not fill-driven
- Raw production logs not public; reproducibility via probe/k6 tooling (Appendix A)

---

## 8. Conclusion

HOOX demonstrates edge-native retail trading with median 22 ms production signal-to-ack, near-zero infra cost at modest scale, and layered security. Open source under CC BY 4.0 since late 2024.

---

## Appendix A: Reproducibility

```bash
hoox perf fastpath run --n 100 --concurrency 8
BASE_URL=https://<gateway>.workers.dev HOOX_API_KEY=<key> k6 run tests/load/webhook-flow.js
```

---

## References

[1] Hasbrouck (2007). [2] Hendershott & Riordan (2011). [3] Jonas et al. (2017). [4–7] Cloudflare docs. [8] Shpektor et al. (2019). [9] hoox-setup (2026). [10–11] Freqtrade, Jesse. [12] Baldini et al. (2017). [13] Chainlink. [14] k6.

**License:** CC BY 4.0