<!-- Context: project-intelligence/concepts | Priority: critical | Version: 4.1 | Updated: 2026-05-14 -->

# Architecture

**Concept**: Hoox is a Cloudflare Edge Worker platform. `hoox` gateway routes external requests to internal workers via Service Bindings. 10 workers across the edge, all on Free plan. Dashboard uses Next.js 16 + OpenNext deployed to Cloudflare Workers. The `.opencode/` directory serves as the central project-knowledge hub (plans, specs, context, skills, tasks).

## Key Points

- **Gateway pattern**: `hoox` validates API keys, KV-backed rate limiter, real DO idempotency, then forwards to `trade-worker`, `telegram-worker`, etc.
- **10 workers**: hoox, trade-worker, agent-worker, telegram-worker, d1-worker, web3-wallet-worker, email-worker, analytics-worker, report-worker, dashboard
- **Smart Placement** enabled on 9 workers (all except dashboard) — 30-60% latency reduction for latency-sensitive workers
- **Observability**: All 10 workers have `observability.enabled = true` (including dashboard via OpenNext runtime)
- **Cron**: `agent-worker` every 5 min (AI risk), `report-worker` 06:00+18:00 UTC (PDF reports), `email-worker` every 5 min (email polling)

## Worker Map

| Worker             | Role                     | Cron          | Public | Smart Placement | Observability |
| ------------------ | ------------------------ | ------------- | ------ | --------------- | ------------- |
| hoox               | Gateway entry point      | No            | ✅     | ✅              | ✅            |
| trade-worker       | Multi-exchange execution | No            | ❌     | ✅              | ✅            |
| agent-worker       | AI risk manager          | ✅ (\*/5)     | ❌     | ✅              | ✅            |
| telegram-worker    | Notifications            | No            | ❌     | ✅              | ✅            |
| d1-worker          | Database operations      | No            | ❌     | ✅              | ✅            |
| web3-wallet-worker | DeFi/on-chain            | No            | ❌     | ✅              | ✅            |
| email-worker       | Email parsing            | ✅ (\*/5)     | ❌     | ✅              | ✅            |
| analytics-worker   | Time-series analytics    | No            | ❌     | ✅              | ✅            |
| report-worker      | PDF reports              | ✅ 06+18UTC   | ❌     | ✅              | ✅            |
| dashboard          | Next.js 16 UI            | No            | ✅     | —               | ✅            |

## Integrated Services (all Free plan)

| Service             | Used By                        | Since  |
| ------------------- | ------------------------------ | ------ |
| Smart Placement     | hoox, trade, agent, telegram, d1, web3, email, analytics, report | v0.3.3 |
| Durable Objects     | hoox (IdempotencyStore)        | v0.3.3 |
| KV-backed Rate Limiting | hoox                          | v0.3.3 |
| Browser Rendering   | report-worker (PDF)            | v0.3.3 |
| Analytics Engine    | analytics-worker + all workers | v0.3.3 |
| Workers AI          | agent, telegram, hoox          | v0.2   |
| Vectorize           | telegram, hoox                 | v0.2   |
| WAF + CLI           | Zone-level, `hoox waf` command | v0.3   |

## Service Binding Mesh

The service binding mesh connects all internal workers. Arrows indicate "calls" direction:

```
hoox ──→ analytics-worker, trade-worker, telegram-worker
trade-worker ──→ d1-worker, telegram-worker, analytics-worker
agent-worker ──→ d1-worker, trade-worker, telegram-worker
telegram-worker ──→ analytics-worker
d1-worker ──→ analytics-worker
web3-wallet-worker ──→ telegram-worker, analytics-worker
email-worker ──→ trade-worker, analytics-worker
report-worker ──→ d1-worker, telegram-worker
dashboard ──→ d1-worker, agent-worker
analytics-worker → (no service bindings, called by 6 workers)
```

## 📂 Codebase References

**Gateway**: `workers/hoox/src/index.ts`
**Idempotency DO**: `workers/hoox/src/idempotencyStore.ts`
**Rate limiter**: `workers/hoox/src/rateLimiter.ts`
**Report worker**: `workers/report-worker/src/index.ts`
**Shared Router**: `packages/shared/src/router.ts`
**Docs site**: `pages/docs/` — Astro 6 static site on GitHub Pages
**Central context hub**: `.opencode/context/` `.opencode/plans/` `.opencode/specs/` `.opencode/tasks.md`
