<!-- Context: project-intelligence/concepts | Priority: critical | Version: 2.0 | Updated: 2026-05-10 -->

# Architecture

**Concept**: Hoox is a Cloudflare Edge Worker platform where `hoox` gateway routes external requests to internal workers via Service Bindings. Dashboard uses Next.js 16 + OpenNext deployed to Cloudflare Workers.

## Key Points

- **Gateway pattern**: `hoox` validates API keys, then forwards to `trade-worker`, `telegram-worker`, etc.
- **Inter-worker comms**: Service Bindings + `internalAuthKey` header for internal auth
- **Storage**: D1 (SQL), R2 (files), KV (config), Durable Objects (idempotency), Queues (async)
- **Cron**: `agent-worker` runs every 5 min for AI risk management

## Worker Fetch Pattern

All workers (except `email-worker`) use a standardized fetch handler pattern:

1. **`createRouter<Env>()`** — path-based routing from `@jango-blockchained/hoox-shared/router`
2. **`withRequestLog()`** — request/response logging wrapper from `@jango-blockchained/hoox-shared/middleware`
3. **`healthCheck()`** — standardized `/health` endpoint from `@jango-blockchained/hoox-shared/health`

```typescript
// Standard worker fetch handler pattern
const router = createRouter<Env>();
router.get("/health", (req, env, ctx) => healthCheck({ worker: "my-worker" }));
router.post("/process", async (req, env, ctx) => { /* handler */ });

export default {
  fetch: withRequestLog(
    (request: Request, env: Env, ctx: ExecutionContext) => router.handle(request, env, ctx),
    { service: "my-worker", module: "router" }
  ),
};
```

Workers currently using this pattern: `trade-worker`, `telegram-worker`, `agent-worker`, `web3-wallet-worker`, `d1-worker`.
Exceptions: `hoox` (inline fetch), `email-worker` (content-type based routing).

## Worker Map

| Worker             | Role                     | Cron      | Public | Fetch Pattern |
| ------------------ | ------------------------ | --------- | ------ | ------------- |
| hoox               | Gateway entry point      | No        | ✅     | Inline fetch  |
| trade-worker       | Multi-exchange execution | No        | ❌     | Router + Log  |
| agent-worker       | AI risk manager          | ✅ (\*/5) | ❌     | Router + Log  |
| telegram-worker    | Notifications            | No        | ❌     | Router + Log  |
| d1-worker          | Database operations      | No        | ❌     | Router + Log  |
| web3-wallet-worker | DeFi/on-chain            | No        | ❌     | Router + Log  |
| email-worker       | Email parsing            | No        | ❌     | Inline fetch  |

## Trade Worker Module Structure

`trade-worker` (`workers/trade-worker/src/`, 1374→593 lines) is split into focused modules:

| Module | File | Responsibility |
|--------|------|---------------|
| `index.ts` | Routes, router, queue handler, request handlers | Orchestration |
| `execution.ts` | `executeTrade()`, `validateTradePayload()`, `validateApiCredentials()`, `updateD1TradeRecords()` | Core trade execution |
| `signals.ts` | `insertSignal()`, `getRecentSignals()`, `handlePost*SignalRequest()` | D1 signal CRUD |
| `reports.ts` | `saveReportToR2()`, `handleGetReportRequest()` | R2 report storage |
| `notifications.ts` | `sendTradeNotificationToTelegram()`, `sendTradeNotification()` | Telegram alerts |
| Exchange clients | `mexc-client.ts`, `binance-client.ts`, `bybit-client.ts` | Exchange API wrappers |
| `exchange-router.ts` | Route trades to correct exchange | Resolution |
| `db-logger.ts` | `DbLogger` class | D1 request/response logging |

## 📂 Codebase References

**Gateway**: `workers/hoox/src/index.ts` - Request routing logic
**Config**: `wrangler.jsonc` - Central worker configuration (includes `dev.runtime` for runtime preference)
**Shared Router**: `packages/shared/src/router.ts` - `createRouter<Env>()` implementation
**Health Check**: `packages/shared/src/health.ts` - `healthCheck()` function
**Request Logger**: `packages/shared/src/middleware/logger.ts` - `withRequestLog()` wrapper
**D1 Repository**: `packages/shared/src/d1/repository.ts` - `D1Repository` class
