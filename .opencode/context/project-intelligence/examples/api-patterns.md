<!-- Context: project-intelligence/examples | Priority: high | Version: 2.0 | Updated: 2026-05-10 -->

# API Patterns

**Concept**: External requests hit `hoox` gateway (POST `/`), internal workers use `createRouter<Env>()` with `withRequestLog` wrapper. Standardized health checks across all workers.

## External Request (hoox gateway)

```json
POST /
{ "apiKey": "key", "telegram": { "chatId": "123", "message": "hi" } }
```

## Standard Fetch Handler Pattern

Workers use `createRouter<Env>()` + `withRequestLog()` for consistent routing and logging:

```typescript
import { createRouter } from "@jango-blockchained/hoox-shared/router";
import { withRequestLog } from "@jango-blockchained/hoox-shared/middleware";
import { healthCheck } from "@jango-blockchained/hoox-shared/health";

interface Env { /* worker-specific bindings */ }

const router = createRouter<Env>();

// Standard health endpoint
router.get("/health", async (req, env, ctx) => {
  return healthCheck({ worker: "my-worker" });
});

// Protected endpoint with inline auth
router.post("/process", async (req, env, ctx) => {
  const auth = req.headers.get("X-Internal-Auth-Key");
  if (auth !== env.INTERNAL_KEY_BINDING)
    return new Response("Unauthorized", { status: 401 });
  // ... handler logic
});

export default {
  fetch: withRequestLog(
    (request, env, ctx) => router.handle(request, env, ctx),
    { service: "my-worker", module: "router" }
  ),
};
```

## Health Check Pattern

Every worker has a `GET /health` endpoint using the shared `healthCheck()`:

```typescript
import { healthCheck } from "@jango-blockchained/hoox-shared/health";

// Simple health check
router.get("/health", () => healthCheck({ worker: "my-worker" }));

// Health check with DB verification (d1-worker pattern)
router.get("/health", async (req, env, ctx) => {
  try {
    await env.DB.prepare("SELECT 1").first();
  } catch {
    return Errors.internal("Database unreachable");
  }
  return healthCheck({ worker: "d1-worker" });
});
```

Response format:
```json
{
  "success": true,
  "result": {
    "status": "ok",
    "timestamp": "2026-05-10T12:00:00.000Z",
    "service": "my-worker"
  }
}
```

## Response Format

```json
{
  "success": true,
  "result": { ... },
  "error": null
}
```

## Endpoint Quick Ref

| Worker             | Endpoints                                            | Methods      |
| ------------------ | ---------------------------------------------------- | ------------ |
| hoox               | `/`, `/health`                                       | POST, GET    |
| trade-worker       | `/process`, `/webhook`, `/health`, `/api/signals`, `/report` | POST, GET |
| telegram-worker    | `/process`, `/webhook`, `/health`                    | POST, GET    |
| agent-worker       | `/agent/status`, `/agent/risk-override`, `/agent/chat`, `/agent/health`, `/health` + more | GET, POST |
| d1-worker          | `/query`, `/batch`, `/health`, `/api/settings`, `/api/balances`, `/api/positions`, `/api/logs` | POST, GET |
| web3-wallet-worker | `/`, `/health`                                       | GET          |
| email-worker       | `*`, `/health`                                       | POST, GET    |

## 📂 Codebase References

**Gateway**: `workers/hoox/src/index.ts` - fetch handler
**Endpoints doc**: `docs/api/endpoints.md`
**Shared Router**: `packages/shared/src/router.ts`
**Health Check**: `packages/shared/src/health.ts`
**Logger Middleware**: `packages/shared/src/middleware/logger.ts`
