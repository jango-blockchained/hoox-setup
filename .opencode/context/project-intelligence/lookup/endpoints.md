<!-- Context: project-intelligence/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-03 -->

# Endpoint Lookup

**Concept**: Quick reference for all worker endpoints and their auth requirements.

## Public Endpoints (via hoox gateway)

| Endpoint | Method | Auth   | Description        |
| -------- | ------ | ------ | ------------------ |
| `/`      | POST   | apiKey | Main webhook entry |

## Internal Endpoints (Service Bindings)

| Worker             | Endpoint               | Method   | Purpose           |
| ------------------ | ---------------------- | -------- | ----------------- |
| trade-worker       | `/process`             | POST     | Execute trade     |
| trade-worker       | `/api/signals`         | GET/POST | Trade signals     |
| telegram-worker    | `/process`             | POST     | Send notification |
| telegram-worker    | `/webhook`             | POST     | Telegram updates  |
| agent-worker       | `/agent/status`        | GET      | Health check      |
| agent-worker       | `/agent/chat`          | POST     | AI chat (SSE)     |
| agent-worker       | `/agent/risk-override` | POST     | Kill switch       |
| d1-worker          | `/query`               | POST     | SQL query         |
| d1-worker          | `/api/dashboard/*`     | GET      | Dashboard data    |
| web3-wallet-worker | `/`                    | GET      | Wallet address    |

## Agent-Worker (NEW features)

`/agent/vision`, `/agent/reasoning`, `/agent/usage`, `/agent/embedding`

## 📂 Codebase References

**Full docs**: `docs/api/endpoints.md`
**Gateway routing**: `workers/hoox/src/index.ts`
