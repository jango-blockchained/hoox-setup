<!-- Context: project-intelligence/concepts | Priority: critical | Version: 3.0 | Updated: 2026-05-12 -->

# Architecture

**Concept**: Hoox is a Cloudflare Edge Worker platform. `hoox` gateway routes external requests to internal workers via Service Bindings. 9 workers across the edge, all on Free plan. Dashboard uses Next.js 16 + OpenNext deployed to Cloudflare Workers.

## Key Points

- **Gateway pattern**: `hoox` validates API keys, KV-backed rate limiter, real DO idempotency, then forwards to `trade-worker`, `telegram-worker`, etc.
- **9 workers**: hoox, trade-worker, agent-worker, telegram-worker, d1-worker, web3-wallet-worker, email-worker, analytics-worker, report-worker
- **Smart Placement** enabled on 5 workers (hoox, trade, agent, d1, telegram) — 30-60% latency reduction
- **Observability**: analytics-worker collects time-series data; 7 workers have `observability.enabled = true`
- **Cron**: `agent-worker` every 5 min (AI risk), `report-worker` 06:00+18:00 UTC (PDF reports)

## Worker Map

| Worker             | Role                     | Cron        | Public | Smart Placement | Observability |
| ------------------ | ------------------------ | ----------- | ------ | --------------- | ------------- |
| hoox               | Gateway entry point      | No          | ✅     | ✅              | ✅            |
| trade-worker       | Multi-exchange execution | No          | ❌     | ✅              | ✅            |
| agent-worker       | AI risk manager          | ✅ (\*/5)   | ❌     | ✅              | ✅            |
| telegram-worker    | Notifications            | No          | ❌     | ✅              | ✅            |
| d1-worker          | Database operations      | No          | ❌     | ✅              | ✅            |
| web3-wallet-worker | DeFi/on-chain            | No          | ❌     | —               | —            |
| email-worker       | Email parsing            | No          | ❌     | —               | —            |
| analytics-worker   | Time-series analytics    | No          | ❌     | —               | —            |
| report-worker      | PDF reports              | ✅ 06+18UTC | ❌     | ✅              | ✅            |

## Integrated Services (all Free plan)

| Service             | Used By                        | Since  |
| ------------------- | ------------------------------ | ------ |
| Smart Placement     | hoox, trade, agent, d1, telegram | v0.3.3 |
| Durable Objects     | hoox (IdempotencyStore)        | v0.3.3 |
| KV-backed Rate Limiting | hoox                          | v0.3.3 |
| Browser Rendering   | report-worker (PDF)            | v0.3.3 |
| Analytics Engine    | analytics-worker + all workers | v0.3.3 |
| Workers AI          | agent, telegram, hoox          | v0.2   |
| Vectorize           | telegram, hoox                 | v0.2   |
| WAF + CLI           | Zone-level, `hoox waf` command | v0.3   |

## 📂 Codebase References

**Gateway**: `workers/hoox/src/index.ts`
**Idempotency DO**: `workers/hoox/src/idempotencyStore.ts`
**Rate limiter**: `workers/hoox/src/rateLimiter.ts`
**Report worker**: `workers/report-worker/src/index.ts`
**Shared Router**: `packages/shared/src/router.ts`
