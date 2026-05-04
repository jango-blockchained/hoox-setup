# 🧪 Testing

> Validating functionality of Hoox workers

## Overview

We use **Bun**'s native test runner (`bun test`) to validate the logic of our Cloudflare® Workers. Testing serverless edge functions requires a combination of unit tests and integration tests that mock Cloudflare®'s bindings (KV, D1, Service Bindings).

## Running Tests

### All Packages

```bash
# From repo root - runs all tests
bun test

# With coverage report
bun test --coverage
```

### Per Package

```bash
# hoox-cli
cd packages/hoox-cli && bun test

# Specific worker
cd workers/agent-worker && bun test

# Or use the management script
hoox workers test hoox
```

### Watch Mode

```bash
# Watch mode for active development
cd packages/hoox-cli && bun test --watch
```

## Mocking Bindings

Cloudflare® bindings must be mocked during local testing. We typically use standard JavaScript stubs to mock `env.SERVICE.fetch` or `env.KV.get`.

Example of mocking a Service Binding in a unit test:

```typescript
import { describe, it, expect } from "bun:test";
import type { Env } from "../src/index";

describe("hoox Gateway", () => {
  it("should forward trade requests to trade-worker", async () => {
    // Mock the environment safely without using 'as any'
    const mockEnv = {
      TRADE_SERVICE: {
        fetch: async (url: any, options: any) => {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
          });
        },
      },
    } as unknown as Env;

    // Test logic here
  });
});
```

### Type Safety in Tests

We enforce strict TypeScript typing across our codebase, including test files. **Do not use `as any`**. When mocking complex objects like the Cloudflare `Env`, cast your mock object securely using `as unknown as Env`.

## Integration Tests

We use `@cloudflare/vitest-pool-workers` to run full end-to-end integration tests that mock the Cloudflare Workers environment and service bindings.

To run the integration test suite:

```bash
bun run test:integration
```

Integration tests are located in the `tests/integration` directory and utilize a `vitest.config.ts` configuration.

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

## Test Coverage by Package

We use `bun test --coverage` to track code coverage across the project. The CI pipeline enforces a minimum 80% coverage threshold.

### Coverage Results (as of May 2026)

| Package/File             | Function Coverage | Line Coverage | Status               |
| ------------------------ | ----------------- | ------------- | -------------------- |
| **packages/hoox-cli**    |                   |               |                      |
| cf-client.ts             | 100%              | 100%          | ✅                   |
| utils.ts                 | 83.33%            | 83.51%        | ✅                   |
| validation.ts            | 92.86%            | 74.37%        | ⚠️ (functions only)  |
| configUtils.ts           | 68.18%            | 40.48%        | ❌ Needs improvement |
| workerCommands.ts        | 22.73%            | 2.27%         | ❌ Needs improvement |
| **workers/hoox**         |                   |               |                      |
| index.ts                 | 85%               | 82%           | ✅                   |
| **workers/trade-worker** |                   |               |                      |
| index.ts                 | 88%               | 85%           | ✅                   |
| **workers/agent-worker** |                   |               |                      |
| index.ts                 | 90%               | 87%           | ✅                   |

> **Note**: Coverage percentages shown are when running test files in isolation. Running all tests together may show lower coverage due to test isolation issues with module mocking.

### Running Coverage Reports

```bash
# Run all tests with coverage
bun test packages/hoox-cli --coverage

# Run specific package tests
bun test workers/hoox --coverage

# Check coverage for a specific file (in isolation)
cd packages/hoox-cli && bun test test/cf-client.test.ts --coverage
```

### Improving Coverage

To improve coverage for a specific file:

1. Identify uncovered lines from the coverage report
2. Create or update test files in the appropriate `test/` directory
3. Mock external dependencies using `mock.module()` from `bun:test`
4. Run the test in isolation to verify coverage improvement
5. Ensure tests pass when run individually: `bun test test/your-test.test.ts --coverage`

## Next Steps

- [Local Development](local-dev.md)
- [Debugging](debugging.md)

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._
