<!-- Context: project-intelligence/lookup | Priority: medium | Version: 3.0 | Updated: 2026-05-14 -->

# Endpoint Lookup

**Concept**: Quick reference for all worker endpoints and their auth requirements. All workers have a standardized `GET /health` endpoint now.

## Public Endpoints (via hoox gateway)

| Endpoint | Method | Auth   | Description        |
| -------- | ------ | ------ | ------------------ |
| `/`      | POST   | apiKey | Main webhook entry |

## Health Endpoints (all workers)

Every worker exposes `GET /health` returning `{ success: true, result: { status: "ok", timestamp, service } }`:

| Worker             | Health Endpoint | Notes |
| ------------------ | --------------- | ----- |
| hoox               | `/health` | Wrapped with security headers via `wrapResponse()` |
| trade-worker       | `/health` | |
| telegram-worker    | `/health` | |
| agent-worker       | `/health` | Also has `/agent/health` (provider status, distinct) |
| d1-worker          | `/health` | Also verifies DB connectivity with `SELECT 1` |
| web3-wallet-worker | `/health` | |
| email-worker       | `/health` | Inline in fetch handler (content-type routing) |
| analytics-worker   | `/health` | No dedicated health handler (uses fetch pattern) |
| report-worker      | `/health` | Returns `{ status: "ok", worker: "report-worker" }` |
| dashboard          | `/api/health` | Next.js API route |

## Internal Endpoints (Service Bindings)

| Worker             | Endpoint                     | Method   | Purpose            |
| ------------------ | ---------------------------- | -------- | ------------------ |
| trade-worker       | `/process`                   | POST     | Execute trade      |
| trade-worker       | `/webhook`                   | POST     | Trade webhook      |
| trade-worker       | `/api/signals`               | GET/POST | Trade signals CRUD |
| trade-worker       | `/report`                    | GET      | R2 report retrieval|
| telegram-worker    | `/process`                   | POST     | Send notification  |
| telegram-worker    | `/webhook`                   | POST     | Telegram bot updates|
| agent-worker       | `/agent/housekeeping`        | GET      | Housekeeping       |
| agent-worker       | `/agent/risk-override`       | POST     | Kill switch        |
| agent-worker       | `/agent/status`              | GET      | System status      |
| agent-worker       | `/agent/config`              | GET/POST | Configuration      |
| agent-worker       | `/agent/test-model`          | POST     | Model testing      |
| agent-worker       | `/agent/health`              | GET      | Provider health    |
| agent-worker       | `/agent/models`              | GET      | Available models   |
| agent-worker       | `/agent/chat`                | POST     | AI chat (SSE)      |
| agent-worker       | `/agent/embedding`           | POST     | Embeddings         |
| d1-worker          | `/query`                     | POST     | SQL query          |
| d1-worker          | `/batch`                     | POST     | Batch SQL          |
| d1-worker          | `/api/settings`              | GET/POST | Dashboard settings |
| d1-worker          | `/api/balances`              | GET      | Portfolio balances |
| d1-worker          | `/api/positions`             | GET      | Open positions     |
| d1-worker          | `/api/logs`                  | GET      | System logs        |
| web3-wallet-worker | `/`                          | GET      | Wallet address     |
| email-worker       | `*` (any path)               | POST     | Email/JSON parsing |
| analytics-worker   | `/track/trade`               | POST     | Track trade event  |
| analytics-worker   | `/track/api-call`            | POST     | Track API call     |
| analytics-worker   | `/track/worker-perf`         | POST     | Track worker perf  |
| analytics-worker   | `/track/signal`              | POST     | Track signal       |
| analytics-worker   | `/track/notification`        | POST     | Track notification |
| report-worker      | `/report`                    | GET      | Trigger PDF report |
| report-worker      | `/health`                    | GET      | Health check       |

## 📂 Codebase References

**Full docs**: `docs/api/endpoints.md`
**Gateway routing**: `workers/hoox/src/index.ts`
**Agent routes**: `workers/agent-worker/src/index.ts:30-90`
