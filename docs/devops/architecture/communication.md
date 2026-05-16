---
title: "🔗 Worker Communication"
description: "How workers communicate with each other"
---

# 🔗 Worker Communication

> How workers communicate with each other

## Service Bindings

Service bindings allow direct HTTP calls between workers without network latency:

```typescript
// In hoox/wrangler.jsonc
{
  "services": [
    { "binding": "ANALYTICS_SERVICE", "service": "analytics-worker" },
    { "binding": "TRADE_SERVICE", "service": "trade-worker" },
    { "binding": "TELEGRAM_SERVICE", "service": "telegram-worker" }
  ]
}
```

### Making Service Calls

```typescript
export default {
  async fetch(request, env) {
    // Call trade-worker
    const tradeResponse = await env.TRADE_SERVICE.fetch(
      "https://trade-worker/sub/path",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: "mexc",
          action: "LONG",
          symbol: "BTC_USDT",
          quantity: 0.01,
        }),
      }
    );

    const result = await tradeResponse.json();
    return new Response(JSON.stringify(result), { status: 200 });
  },
};
```

## Communication Table

| From → To                | Binding           | Method        | Purpose                     |
| ------------------------ | ----------------- | ------------- | --------------------------- |
| hoox → analytics-worker  | ANALYTICS_SERVICE | POST /track   | Track API call metrics      |
| hoox → trade-worker      | TRADE_SERVICE     | POST /webhook | Execute trade               |
| hoox → telegram-worker   | TELEGRAM_SERVICE  | POST /process | Send notification           |
| trade-worker → d1-worker | D1_SERVICE        | SQL queries   | Log signals                 |
| trade-worker → web3      | WEB3_WALLET       | POST          | Web3 ops                    |
| trade-worker → telegram  | TELEGRAM_SERVICE  | POST          | Trade notification          |
| trade-worker → analytics | ANALYTICS_SERVICE | POST /track   | Track execution metrics     |
| telegram → analytics     | ANALYTICS_SERVICE | POST /track   | Track message processing    |
| telegram → trade-worker  | TRADE_SERVICE     | POST          | Status check                |
| report → telegram-worker | TELEGRAM_SERVICE  | POST /process | Send PDF report link        |
| agent → trade-worker     | TRADE_SERVICE     | POST          | Risk management actions     |
| agent → d1-worker        | D1_SERVICE        | SQL queries   | Portfolio queries           |
| agent → telegram-worker  | TELEGRAM_SERVICE  | POST          | Health summary delivery     |
| email → analytics-worker | ANALYTICS_SERVICE | POST /track   | Track email parsing metrics |

## Request/Response Format

### Standard Request

```typescript
interface WorkerRequest {
  requestId: string; // UUID for tracing
  internalAuthKey: string; // Service authentication
  payload: {
    // Worker-specific payload
  };
}
```

### Standard Response

```typescript
interface WorkerResponse {
  success: boolean;
  requestId: string;
  result?: any;
  error?: string;
}
```

## Error Handling

```typescript
async function callWorker(env, serviceBinding) {
  try {
    const response = await serviceBinding.fetch(url, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Worker error: ${response.status} - ${error}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Service call failed:", error);
    return { success: false, error: error.message };
  }
}
```

## Authentication Between Workers

All internal workers use the shared `requireInternalAuth` middleware from `@jango-blockchained/hoox-shared/middleware`, which expects a consistent `X-Internal-Auth-Key` header and validates it against the `INTERNAL_KEY_BINDING` environment binding.

### Using requireInternalAuth (Standard)

```typescript
import { requireInternalAuth } from "@jango-blockchained/hoox-shared/middleware";

async function handleRequest(request: Request, env: Env): Promise<Response> {
  // Returns 401 Response if invalid, null if authorized
  const authError = requireInternalAuth(request, env, "INTERNAL_KEY_BINDING");
  if (authError) return authError;

  // Authorized — process request
}
```

### Sending Authenticated Requests

```typescript
// In the calling worker
const response = await serviceFetch(env.TRADE_SERVICE, "/webhook", payload, {
  headers: { "X-Internal-Auth-Key": env.INTERNAL_KEY_BINDING as string },
});
```

All internal-only workers (trade-worker, d1-worker, agent-worker, telegram-worker) now use the **same** `INTERNAL_KEY_BINDING` binding name, simplifying secret management and deployment.

## Testing Service Bindings

```typescript
// mock service binding in tests
const mockEnv = {
  TRADE_SERVICE: {
    fetch: async (url, options) => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
      });
    },
  },
};
```

## Next Steps

- [API Endpoints](../api/endpoints.md)
- [Development](../development/local-dev.md)
