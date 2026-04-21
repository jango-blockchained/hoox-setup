# 🧪 Testing

> Validating functionality of Hoox workers

## Overview

We use **Bun**'s native test runner (`bun test`) to validate the logic of our Cloudflare® Workers. Testing serverless edge functions requires a combination of unit tests and integration tests that mock Cloudflare®'s bindings (KV, D1, Service Bindings).

## Running Tests

### Per Worker

```bash
# From any worker directory
cd workers/agent-worker
bun test

# Or with watch mode
bun test:watch
```

### Using Management Script

```bash
bun run scripts/manage.ts workers test hoox
```

## Mocking Bindings

Cloudflare® bindings must be mocked during local testing. We typically use standard JavaScript stubs to mock `env.SERVICE.fetch` or `env.KV.get`.

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

## Development Commands

All workers follow standardized commands using Bun:

```bash
# Install dependencies (per worker)
bun install

# Run tests
bun test

# Run typecheck
bun run typecheck
# or
npx tsc --noEmit

# Local development
bunx wrangler dev

# Deploy to Cloudflare
bunx wrangler deploy
```

## Test Coverage by Worker

| Worker | Test Command | Status |
|---|---|---|
| agent-worker | `bun test` | ✓ Passing |
| dashboard-worker | `bun test` | ✓ Passing |
| d1-worker | `bun test` | ✓ Passing |
| trade-worker | `bun test` | ✓ Passing |
| hoox | `bun test` | ✓ Passing |
| telegram-worker | `bun test` | ✓ Passing |

## Next Steps

- [Local Development](local-dev.md)
- [Debugging](debugging.md)

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
