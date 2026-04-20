# 🔗 Worker Communication

> How workers communicate with each other

## Service Bindings

Service bindings allow direct HTTP calls between workers without network latency:

```typescript
// In hoox/wrangler.jsonc
{
  "services": [
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
      },
    );

    const result = await tradeResponse.json();
    return new Response(JSON.stringify(result), { status: 200 });
  },
};
```

## Communication Table

| From → To                | Binding          | Method        | Purpose           |
| ------------------------ | ---------------- | ------------- | ----------------- |
| hoox → trade-worker      | TRADE_SERVICE    | POST /webhook | Execute trade     |
| hoox → telegram-worker   | TELEGRAM_SERVICE | POST /process | Send notification |
| trade-worker → d1-worker | D1_SERVICE       | SQL queries   | Log signals       |
| trade-worker → web3      | WEB3_WALLET      | POST          | Web3 ops          |
| telegram → trade-worker  | TRADE_SERVICE    | POST          | Status check      |

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

### Using Internal Key

```typescript
// Verify internal key in receiving worker
const INTERNAL_KEY = await env.INTERNAL_KEY_BINDING?.get();

export async function handleRequest(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (authHeader !== INTERNAL_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Process request...
}
```

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
