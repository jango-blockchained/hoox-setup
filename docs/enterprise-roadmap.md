# Enterprise Feature Roadmap

**Leveraging Cloudflare Paid/Enterprise Services for hoox**

> **Status:** Planning | **Last Updated:** 2026-05-12 (pricing rechecked against Cloudflare docs & llms.txt)
> **Source:** [developers.cloudflare.com/llms.txt](https://developers.cloudflare.com/llms.txt) + Context7 API

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Cloudflare Plans at a Glance](#2-cloudflare-plans-at-a-glance)
3. [Phase I — Operational Baseline ($5/mo Workers Paid)](#3-phase-i--operational-baseline-5mo-workers-paid)
4. [Phase II — Intelligent Trading ($5-50/mo + AI Usage)](#4-phase-ii--intelligent-trading-5-50mo--ai-usage)
5. [Phase III — Enterprise Scale ($200-300/mo)](#5-phase-iii--enterprise-scale-200-300mo)
6. [Phase IV — Multi-Tenant SaaS Platform ($500+/mo)](#6-phase-iv--multi-tenant-saas-platform-500mo)
7. [Cost Projections](#7-cost-projections)

---

## 1. Current Architecture

Hoox runs **entirely on Cloudflare Free Plan** today. All services below are already available at no cost:

| Service | Free Plan Limit | Current hoox Usage |
|---------|----------------|-------------------|
| Workers Requests | 100K/day | ~5K/day |
| D1 (SQL) | 5M rows read/day, 100K write/day, 5GB | Minimal |
| KV | 1GB, 100K ops/day | Config reads |
| R2 | 10GB storage | Reports |
| Queues | 1M ops/month | Async trade routing |
| Cron Triggers | 5 | 1 (agent-worker) |
| **Durable Objects** | 100K req/day, SQLite storage | Idempotency |
| **Smart Placement** | Included on all plans | — |
| **WAF** | Free managed ruleset (all plans) | — |
| **Rate Limiting** | 1 free rule (IP only, 10s period) | — |
| **Browser Rendering** | 10 min/day | — |
| **Workers AI** | 10K neurons/day | — |
| **AI Gateway** | Core features free | — |
| **Vectorize** | 100 indexes, 10M vectors | — |
| **Analytics Engine** | 100K writes/day | — |

> ⚠️ Most services previously marked "Paid Only" in our roadmap are now **available on the Free plan** with generous limits.

---

## 2. Cloudflare Plans at a Glance

| Tier | Cost | Key Unlocks |
|------|------|------------|
| **Free** | $0 | All services above with daily/monthly limits |
| **Workers Paid** | **$5/mo** (min) | Higher limits on all services, 30s CPU, 7-day logs, Tail Workers |
| **Enterprise** | Custom | Custom SLAs (99.99%), Advanced DDoS, Waiting Room, Workers for Platforms, dedicated support |

### Premium Add-ons (Workers Paid tier)

| Add-on | Cost |
|--------|------|
| Hyperdrive (DB acceleration) | $5 + $0.50/GB |
| Load Balancing | $5/pool + $0.50/M req |
| Argo Smart Routing | $0.10/GB (2GB included) |
| Workers AI (beyond 10K free/day) | $0.011/1K neurons |
| Rate Limiting (beyond 1 free rule) | $5/rule/mo |

---

## 3. Phase I — Operational Baseline ($5/mo Workers Paid)

> **Cost: ~$5/mo** | **Unlocks:** Higher limits, 7-day logs, 30s CPU time, Tail Workers

### 3.1 Upgrade to Workers Paid ($5/mo)

Switches all services from daily free limits to monthly paid limits, unlocks 30s CPU per request, and 7-day log retention.

### 3.2 Smart Placement (already free on Free plan — enable now)

```toml
# Add to hoox, trade-worker, agent-worker wrangler.jsonc NOW
[placement]
mode = "smart"
```

Places workers at the optimal edge location closest to exchange APIs — 30-60% latency reduction. **Cost: $0**.

### 3.3 Durable Objects — Trade Idempotency Locks (already free)

DOs with SQLite storage are included on Free/Paid. Use for exactly-once trade execution locks, replacing best-effort idempotency.

### 3.4 WAF + Rate Limiting (already free)

- **WAF**: Free managed ruleset protects against common web attacks. Enable in Cloudflare dashboard now.
- **Rate Limiting**: 1 free rule — apply to `hoox` gateway for API abuse protection.

### 3.5 Tail Workers (Workers Paid only)

Real-time log event stream. Forward trade execution events to external monitoring (Grafana, Datadog).

### 3.6 Analytics Engine (already free, not yet billing)

Time-series metrics at the edge. Build trade latency, error rate, and signal-to-execution dashboards.

---

## 4. Phase II — Intelligent Trading ($5-50/mo + AI Usage)

> **Cost: ~$5-50/mo** | Most services free with limits; pay only for usage beyond free tier

### 4.1 Workers AI — Risk Intelligence

- **Free**: 10K neurons/day (enough for ~50-100 LLM calls/day)
- **Paid**: $0.011/1K neurons beyond free tier
- Models: LLaMA 3.1 8B, BGE embeddings, DeepSeek coder

Use for real-time trade risk analysis, embedding generation for RAG, and anomaly detection.

### 4.2 Vectorize — Semantic Trade Search (already free)

- **Free**: 100 indexes, 10M vectors per index, 1K namespaces
- Embed trade patterns + strategy docs into vectors
- RAG pipeline: augment AI prompts with similar historical trade context

### 4.3 Browser Rendering — Automated Reports (already free)

- **Free**: 10 min/day (2-5 PDF reports)
- Generate PDF portfolio/performance reports on schedule
- Server-side chart rendering for Telegram/email delivery

### 4.4 AI Gateway — Provider Management (already free)

- **Free**: Core features — analytics, caching, rate limiting for AI calls
- Multi-provider fallback: Workers AI → OpenAI → Anthropic
- Cost tracking per strategy/user

### 4.5 Hyperdrive — DB Acceleration ($5 + data)

- **Paid add-on**: $5/mo + $0.50/GB
- Accelerate D1 queries and external DB connections
- Connection pooling for multi-worker DB access

---

## 5. Phase III — Enterprise Scale ($200-300/mo)

> **Cost: ~$250/mo** | Enterprise Workers plan, advanced security, HA

### 5.1 Enterprise Workers (Custom)

- 99.99% uptime SLA for trading infrastructure
- Custom CPU/memory limits
- SOC 2 compliance reports
- 30-min support response

### 5.2 Advanced DDoS + Load Balancing

- **Advanced DDoS**: Enterprise only — L3-L7 protection
- **Load Balancing**: $5/pool + $0.50/M req — multi-region failover

### 5.3 Argo Smart Routing

- $0.10/GB (2GB included) — optimized routing for exchange API calls

---

## 6. Phase IV — Multi-Tenant SaaS Platform ($500+/mo)

> **Cost: ~$500+/mo** | Workers for Platforms, tenant isolation, compliance

### 6.1 Workers for Platforms (Enterprise)

- Dispatch namespace per customer
- Isolated D1 databases per tenant
- Custom domains per tenant via SSL for SaaS

### 6.2 Enterprise Compliance

- Zero Trust integration
- mTLS for exchange connections
- Data residency via Regional Services
- SOC 2 Type II reports

---

## 7. Cost Projections

| Phase | Services | Est. Monthly |
|-------|----------|-------------|
| **Phase I** | Workers Paid ($5) | **~$5** |
| **Phase II** | + Workers AI usage ($0-30) + Hyperdrive ($5-10) | **~$10-45** |
| **Phase III** | Enterprise Workers ($200) + Load Balancing ($5-15) + Argo ($5-10) | **~$210-225** |
| **Phase IV** | Workers for Platforms ($200) + SSL for SaaS ($50) + Compliance | **~$350+** |
| **Full Stack** | All phases combined | **~$500-650/mo** |

### Key correction from previous version

Most services previously marked as "Paid Only" (Durable Objects, Vectorize, Analytics Engine, WAF, Smart Placement, Browser Rendering, AI Gateway) are now **included on the Free plan**. The only required cost is the **Workers Paid plan ($5/mo)** to unlock higher limits, 30s CPU, and Tail Workers.

### Quick Start — Phase I (today)

```bash
# Already using: D1, KV, R2, Queues, DO (idempotency), WAF, Smart Placement
# Upgrade to Workers Paid via dash.cloudflare.com for $5/mo
# Enable Tail Workers and Analytics Engine
```

---

> **References:**
> - [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
> - [Durable Objects](https://developers.cloudflare.com/durable-objects/)
> - [Vectorize](https://developers.cloudflare.com/vectorize/)
> - [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
> - [WAF](https://developers.cloudflare.com/waf/)
> - [AI Gateway](https://developers.cloudflare.com/ai-gateway/)
> - [Browser Rendering](https://developers.cloudflare.com/browser-run/)
> - [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement/)
> - [Cloudflare llms.txt](https://developers.cloudflare.com/llms.txt)
