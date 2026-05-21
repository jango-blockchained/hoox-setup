# 📐 Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records for the Hoox trading platform. Each ADR documents a significant architectural choice, its context, the decision made, and its consequences.

---

## ADR Index

| # | Title | Status | Date |
|---|-------|--------|------|
| 001 | [Cloudflare Workers as Execution Platform](#adr-001) | Accepted | 2025-04 |
| 002 | [SQLite-backed Durable Objects for Idempotency](#adr-002) | Accepted | 2025-05 |
| 003 | [9-Microservice Architecture](#adr-003) | Accepted | 2025-06 |
| 004 | [Dual-Layer Configuration (Env + KV)](#adr-004) | Accepted | 2025-06 |
| 005 | [Multi-Provider AI Gateway with Fallback Chain](#adr-005) | Accepted | 2026-03 |
| 006 | [Bun Workspaces for Monorepo Management](#adr-006) | Accepted | 2025-04 |

---

## ADR-001: Cloudflare Workers as Execution Platform

**Status:** Accepted

**Context:**
Algorithmic trading requires ultra-low latency between signal generation and order execution. Traditional VPS-based bots suffer from 200ms+ round-trip latency due to fixed geographic locations and heavy runtime overhead.

**Decision:**
Deploy all trading logic as Cloudflare Workers running on V8 isolates at the edge. Workers execute in <3ms cold starts, automatically route to the nearest geographic PoP, and integrate natively with Cloudflare's D1, KV, Queues, and R2 storage.

**Consequences:**
- **Positive:** 30-60% latency reduction vs. VPS; $0 compute cost on free tier; automatic global scaling; built-in DDoS protection
- **Negative:** 128MB memory limit per isolate; no arbitrary binaries; limited filesystem access; vendor lock-in to Cloudflare
- **Mitigation:** Web3 wallet worker uses EVM-compatible RPC calls (not binaries); architecture remains portable to Cloudflare-compatible runtimes

---

## ADR-002: SQLite-backed Durable Objects for Idempotency

**Status:** Accepted

**Context:**
Webhook-based trade execution is inherently unreliable — network timeouts can cause TradingView to retry the same signal, potentially resulting in duplicate trades. Financial systems require exactly-once execution semantics.

**Decision:**
Implement idempotency using Cloudflare Durable Objects with SQLite-backed state. Each incoming trade signal is hashed into a unique trace ID. A singleton DO instance per trace ID acts as a distributed mutex lock, atomically checking and recording whether the signal has been processed.

**Consequences:**
- **Positive:** Zero-race-condition dedup with single-threaded DO isolation; <2ms overhead per check; automatic 24h TTL cleanup via DO alarms; survives cold starts
- **Negative:** Adds one network hop per request; DO storage is limited; potential for orphaned DO instances under extreme load
- **Mitigation:** DO alarm scheduled at TTL for automatic garbage collection; monitor DO count via analytics dashboard

---

## ADR-003: 9-Microservice Architecture

**Status:** Accepted

**Context:**
Monolithic trading systems are fragile — a crash in any component (portfolio calculation, notification, database) takes down the entire system. Microservices provide isolation but increase operational complexity.

**Decision:**
Split the platform into 9 specialized workers, each with a single responsibility:

| Worker | Responsibility |
|--------|---------------|
| `hoox` | Gateway, validation, rate limiting, idempotency |
| `trade-worker` | Exchange order execution, leverage calculation |
| `agent-worker` | AI risk management, trailing stops, cron jobs |
| `d1-worker` | All SQLite read/write operations |
| `telegram-worker` | Push notifications, chat command handling |
| `web3-wallet-worker` | On-chain DeFi swap execution |
| `email-worker` | Email signal parsing (POP3/IMAP) |
| `analytics-worker` | Metrics collection and reporting |
| `report-worker` | PDF portfolio report generation |

**Consequences:**
- **Positive:** Independent scaling; failure isolation; focused development; clean ownership boundaries
- **Negative:** More deployment units to manage; Service Binding dependency chain complexity; inter-worker communication overhead
- **Mitigation:** CLI automates dependency-ordered deployment; health check endpoints on every worker; TUI provides real-time status of all 9 workers

---

## ADR-004: Dual-Layer Configuration (Environment + KV)

**Status:** Accepted

**Context:**
Configuration needs fall into two categories: (1) secrets and build-time values that require redeployment to change, and (2) runtime parameters that should be changeable instantly without any deployment.

**Decision:**
Use two distinct configuration layers:

1. **Build-time (`.env.local` + Workers Secrets):** API keys, internal auth keys, dashboard credentials. Managed via `hoox secrets set` and `hoox config env`.
2. **Runtime (Cloudflare KV):** Kill switch, exchange routing, rate-limiter thresholds, email regex patterns. Managed via `hoox config kv set` and propagates globally in <10 seconds.

**Consequences:**
- **Positive:** Kill switch takes effect on next request (no deploy); A/B exchange routing without code changes; audit trail via KV change history; safe emergency response
- **Negative:** Config values read from KV are eventually consistent (up to 10s); dual configuration surfaces increase cognitive load
- **Mitigation:** 16-key KV manifest with documented defaults; `hoox config kv apply-manifest` for one-command sync; documentation clearly separates the two layers

---

## ADR-005: Multi-Provider AI Gateway with Fallback Chain

**Status:** Accepted

**Context:**
The agent-worker needs LLM capabilities for risk assessment, market analysis, and user chat. Single-provider AI introduces single points of failure and cost concentration.

**Decision:**
Implement a 5-provider fallback chain ordered by cost and availability:
```
Workers AI (free) → Anthropic → Google AI → OpenAI → Azure OpenAI
```
Each provider is health-checked before use. On failure, the gateway automatically retries with the next provider. Usage and costs are tracked per-provider.

**Consequences:**
- **Positive:** Zero single point of failure for AI; cost optimization (use free tier first); resilience against provider outages; vision + reasoning + chat in one gateway
- **Negative:** Complex provider abstraction layer; potential for inconsistent response quality across providers; harder to optimize prompts for all providers simultaneously
- **Mitigation:** Provider selection per-request (caller specifies preferred provider); standardized response schemas; usage dashboard for cost monitoring

---

## ADR-006: Bun Workspaces for Monorepo Management

**Status:** Accepted

**Context:**
The project contains multiple packages (CLI, TUI, shared library, 9 workers) that need to share types, utilities, and be tested/developed locally.

**Decision:**
Use Bun Workspaces as the monorepo manager instead of npm/yarn/pnpm workspaces. Rationale:
- Native TypeScript compilation (no separate tsconfig complexity)
- Built-in test runner (no Jest/Mocha dependency)
- Fastest install times among JS package managers
- Single `bun.lockb` lockfile for all workspaces
- Native script runner for CI pipeline

**Consequences:**
- **Positive:** Zero-config TypeScript; fast CI; unified tooling; shared types resolve at compile time
- **Negative:** Bun is less mature than npm ecosystem; some packages may have compatibility issues; harder to onboard developers unfamiliar with Bun
- **Mitigation:** Comprehensive `hoox check prerequisites` validation; Docker runtime as fallback; documentation covers both native and Docker workflows