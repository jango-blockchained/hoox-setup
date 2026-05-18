---
title: "🧪 Testing"
description: "Validating functionality of Hoox workers"
---

# 🧪 Testing

> Validating functionality of Hoox workers

## Overview

All tests use **Bun**'s native test runner (`bun test`). There are **106 test files** across 4 test types:

| Type            | Count | Description                                                                     |
| :-------------- | :---: | :------------------------------------------------------------------------------ |
| **Unit**        |  92   | Isolated function/component tests per package and worker                        |
| **Integration** |   2   | Cross-component tests (TUI navigation, gateway middleware stack)                |
| **E2E**         |   2   | Full-system smoke tests (TUI subprocess, CLI lifecycle)                         |
| **Live**        |  10   | Cloudflare credential-dependent integration tests (D1, KV, R2, Queues, AI, API) |

## Running Tests

### All Tests (excluding live)

```bash
# From repo root — runs all unit, integration, and e2e tests
bun test

# With coverage report
bun test --coverage

# Excluding TUI e2e smoke test (which requires TUI binary)
bun test --path-ignore-patterns 'packages/tui/test/e2e/**'
```

### Test by Category

```bash
# Integration tests
bun run test:integration        # tests/integration/

# E2E tests
bun run test:e2e                # tests/e2e/ + tests/e2e.test.ts

# Live tests (requires Cloudflare credentials in tests/live/.env)
bun run test:live               # tests/live/ --jobs 1
```

### Test by Workspace

```bash
# CLI
bun run test:cli                # packages/cli/

# TUI
bun run test:tui                # packages/tui/

# Shared package
bun run test:shared             # packages/shared/

# All workers (including dashboard)
bun run test:workers            # workers/
```

### Test Single Worker

```bash
# From repo root
bun test workers/agent-worker/
bun test workers/hoox/

# Or cd into the worker directory
cd workers/trade-worker && bun test
```

### Watch Mode

```bash
bun test packages/cli --watch
```

## Test Inventory

| #   | Workspace                        |  Count  | Type(s)                                       |
| --- | -------------------------------- | :-----: | :-------------------------------------------- |
| 1   | **`packages/cli`**               |   28    | Unit                                          |
| 2   | **`packages/shared`**            |   12    | Unit                                          |
| 3   | **`packages/tui`**               |   19    | 17 Unit · 1 Integration · 1 E2E               |
| 4   | **`workers/hoox`**               |    5    | Unit                                          |
| 5   | **`workers/trade-worker`**       |   11    | Unit                                          |
| 6   | **`workers/agent-worker`**       |    5    | Unit                                          |
| 7   | **`workers/d1-worker`**          |    1    | Unit                                          |
| 8   | **`workers/telegram-worker`**    |    1    | Unit                                          |
| 9   | **`workers/email-worker`**       |    3    | Unit                                          |
| 10  | **`workers/analytics-worker`**   |    4    | Unit                                          |
| 11  | **`workers/web3-wallet-worker`** |    1    | Unit                                          |
| 12  | **`workers/dashboard`**          |    4    | Unit                                          |
| 13  | **`workers/report-worker`**      |    0    | —                                             |
|     | **Workspace subtotal**           | **94**  |                                               |
| 14  | **`tests/integration/`**         |    1    | Integration (gateway)                         |
| 15  | **`tests/e2e/`**                 |    1    | E2E (CLI lifecycle)                           |
| 16  | **`tests/live/`**                |   10    | Live (Cloudflare API, D1, KV, R2, Queues, AI) |
|     | **TOTAL**                        | **106** | **92 Unit · 2 Integration · 2 E2E · 10 Live** |

## Mocking Bindings

Cloudflare® bindings must be mocked during local testing. We use standard JavaScript stubs to mock `env.SERVICE.fetch` or `env.KV.get`.

```typescript
import { describe, it, expect } from "bun:test";
import type { Env } from "../src/index";

describe("hoox Gateway", () => {
  it("should forward trade requests to trade-worker", async () => {
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

Enforce strict TypeScript typing — **do not use `as any`**. Cast mock objects securely using `as unknown as Env`.

## Integration Tests

Integration tests use **Miniflare 3** directly (via `bun:test`, not vitest) to simulate Cloudflare Workers with service bindings.

```bash
bun run test:integration
```

Integration tests live in `tests/integration/` and cover:

- Gateway middleware stack (auth → validation → CORS → routing)
- Worker service binding communication (planned: hoox→d1, trade-worker→d1, agent→trade)

## E2E Tests

E2E tests validate full-system workflows:

```bash
bun run test:e2e
```

| File                                  | What it tests                                 |
| :------------------------------------ | :-------------------------------------------- |
| `tests/e2e.test.ts`                   | CLI lifecycle (init → config → check)         |
| `packages/tui/test/e2e/smoke.test.ts` | TUI subprocess launch, render, and clean exit |

## Live Tests

Live tests require Cloudflare credentials and hit real Cloudflare APIs:

```bash
bun run test:live
```

Set credentials in `tests/live/.env`:

```
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
HOOX_D1_DATABASE=...
```

## Build Commands

```bash
# Build all packages that need it (CLI + TUI) + typecheck
bun run build

# Individual builds
bun run build:cli          # packages/cli → dist/
bun run build:tui          # packages/tui → dist/
bun run build:dashboard    # workers/dashboard → next build
bun run build:docs         # pages/docs → astro build

# TypeScript typecheck (all workspaces)
bun run typecheck
```

## Coverage

We use `bun test --coverage` for code coverage. The CI pipeline enforces a minimum 80% coverage threshold.

```bash
# Full coverage
bun test --coverage

# Per workspace
bun test packages/cli --coverage
bun test workers/hoox --coverage
```

> **Note:** Coverage numbers from isolated file runs will differ from full-suite runs.

## Next Steps

- [Local Development](local-dev.md)
- [Debugging](debugging.md)

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._
