# 🧪 Testing

> Validating functionality of Hoox workers

## Overview

We use **Bun**'s native test runner (`bun test`) to validate the logic of our Cloudflare Workers. Testing serverless edge functions requires a combination of unit tests and integration tests that mock Cloudflare's bindings (KV, D1, Service Bindings).

## Running Tests

To run the test suite for all workers:

```bash
bun test
```

To run tests for a specific worker via the management script:

```bash
bun run scripts/manage.ts workers test hoox
```

## Mocking Bindings

Cloudflare bindings must be mocked during local testing. We typically use standard JavaScript stubs to mock `env.SERVICE.fetch` or `env.KV.get`.

Example of mocking a Service Binding in a unit test:

```typescript
import { describe, it, expect } from "bun:test";

describe("hoox Gateway", () => {
  it("should forward trade requests to trade-worker", async () => {
    // Mock the environment
    const mockEnv = {
      TRADE_SERVICE: {
        fetch: async (url, options) => {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
      }
    };

    // Test logic here
  });
});
```

## Next Steps

- [Local Development](local-dev.md)
- [Debugging](debugging.md)