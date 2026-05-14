<!-- Context: project-intelligence/examples | Priority: high | Version: 3.0 | Updated: 2026-05-14 -->

# API Patterns

**Concept**: External requests hit `hoox` gateway (POST `/`), internal workers use `createRouter<Env>()` with `withRequestLog` wrapper. Standardized health checks, auth, and service binding calls across all workers.

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

// Protected endpoint with requireInternalAuth
router.post("/process", async (req, env, ctx) => {
  const authError = requireInternalAuth(req, env, "INTERNAL_KEY");
  if (authError) return authError;
  // ... handler logic
});

export default {
  fetch: withRequestLog(
    (request, env, ctx) => router.handle(request, env, ctx),
    { service: "my-worker", module: "router" }
  ),
};
```

## Auth Pattern: `requireInternalAuth()`

All internal workers use the shared `requireInternalAuth()` middleware:

```typescript
import { requireInternalAuth } from "@jango-blockchained/hoox-shared/middleware";

// Returns Response (401) if unauthorized, null if authorized
const authError = requireInternalAuth(request, env, "INTERNAL_KEY");
if (authError) return authError;
```

## Service Binding Call Pattern: `serviceFetch()`

All inter-worker calls use the shared `serviceFetch()` helper:

```typescript
import { serviceFetch } from "@jango-blockchained/hoox-shared/service-bindings";

// POST with JSON body (default)
const response = await serviceFetch(env.TRADE_SERVICE, "/webhook", payload);

// POST with extra headers
const response = await serviceFetch(env.D1_SERVICE, "/query", { query, params }, {
  headers: { "X-Request-ID": requestId },
});

// GET request (no body)
const response = await serviceFetch(env.D1_SERVICE, "/api/balances", undefined, { method: "GET" });
```

Convention: URL path matches the target worker's route. Uses `http://internal{path}` URL scheme.

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
**Endpoints doc**: `docs/devops/api/endpoints.md`
**Shared Router**: `packages/shared/src/router.ts`
**Health Check**: `packages/shared/src/health.ts`
**Logger Middleware**: `packages/shared/src/middleware/logger.ts`
