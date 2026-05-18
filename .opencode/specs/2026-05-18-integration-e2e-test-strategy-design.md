# Integration & E2E Test Strategy — Design Document

> **Date:** 2026-05-18
> **Status:** Draft

## Problem

The project has 106 test files but only 2 integration tests and 2 E2E tests (one of which is a
`TODO` placeholder). Critical coverage gaps exist:

| Gap                         | Unit Tests | Integration/E2E | Impact                                       |
| :-------------------------- | :--------: | :-------------: | :------------------------------------------- |
| CLI command pipelines       |     28     |      **0**      | Can't verify init→deploy→monitor lifecycle   |
| Worker service bindings     |     35     |      **0**      | No test for inter-worker communication       |
| Dashboard ↔ worker bindings |     4      |      **0**      | Dashboard routes untested with real bindings |
| `report-worker`             |     0      |        0        | Entirely untested — PDF generation           |
| Root E2E                    |     —      | **Placeholder** | `tests/e2e.test.ts` is a `// TODO` stub      |

## Solution

Add integration and E2E tests targeting the pipeline gaps, while converting existing vitest
infrastructure to bun:test (project standard).

## Test Stack

| Layer                 | Framework                       | Rationale                                                                           |
| :-------------------- | :------------------------------ | :---------------------------------------------------------------------------------- |
| All unit tests        | `bun:test`                      | Already the project standard (106 files)                                            |
| All integration tests | `bun:test`                      | Converting from vitest; same runner for all test types                              |
| Worker simulation     | `miniflare` (direct API)        | Previously via `@cloudflare/vitest-pool-workers`; now imported directly in bun:test |
| CLI subprocess        | `Bun.spawnSync()`               | Test actual CLI entry points in temp workspaces                                     |
| Mocking               | `bun:test` `mock()` + `spyOn()` | Already project standard                                                            |

## Migration: vitest → bun:test

The project currently has vestigial vitest configuration despite all 106 tests running via
`bun:test`. Only `tests/integration/gateway.test.ts` depends on vitest (via
`@cloudflare/vitest-pool-workers` for Miniflare).

| What                                            | Action                                                                 |
| :---------------------------------------------- | :--------------------------------------------------------------------- |
| `vitest.config.ts` (root)                       | Delete — integration tests move to bun:test + direct `miniflare` usage |
| `@cloudflare/vitest-pool-workers` dep           | Remove from `devDependencies`                                          |
| `vitest` dep                                    | Remove from `devDependencies`                                          |
| `miniflare`                                     | Add as `devDependency`                                                 |
| `test:integration` script                       | Change to `bun test tests/integration/`                                |
| `test:all` script                               | Remove `vitest` reference                                              |
| analytics-worker `package.json` `vitest` stanza | Remove (stale — tests already use `bun:test`)                          |
| trade-worker `package.json` `vitest` stanza     | Remove (stale — tests already use `bun:test`)                          |

### Why not keep vitest for integration tests?

- **Uniformity:** Every other test in the project uses `bun:test`. Keeping a separate runner for 1
  test file adds cognitive overhead and tooling complexity.
- **Miniflare API:** `miniflare` exposes a clean JavaScript API that works with any test runner.
  The `@cloudflare/vitest-pool-workers` plugin only provides convenience (automatic worker
  lifecycle). We can replicate the same in `beforeAll`/`afterAll` hooks with equivalent code.
- **Performance:** Removing vitest removes an entire test runner from `node_modules` and CI pipeline.

## CLI Non-Interactive Mode

For programmatic integration/E2E testing, the `hoox init` command needs a non-interactive mode.
Currently it relies on `@clack/prompts` for all input.

### Design

```
hoox init --non-interactive \
  --account-id "abc123..." \
  --api-token "token_..." \
  --preset minimal

# Or via stdin:
echo '{"accountId":"abc...","apiToken":"tok...","preset":"minimal"}' | hoox init --non-interactive
```

- `--non-interactive` / `-n` flag skips all `@clack/prompts` calls
- `--account-id`, `--api-token`, `--preset` provide direct values
- Falls back to reading JSON from stdin if flags are missing
- Error exit code + stderr message if required values are missing

## Integration Test Architecture

### CLI Integration (`packages/cli/test/integration/`)

Tests run full CLI commands against temporary workspaces.

```
packages/cli/test/integration/
├── setup.ts       — createTempDir(), MockApiServer class
├── helpers.ts     — common assertions for wrangler.jsonc structure
├── init-pipeline.test.ts
├── config-pipeline.test.ts
└── deploy-pipeline.test.ts
```

**Pattern:**

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createTempDir, cleanupDir } from "./setup";

describe("init pipeline", () => {
  const tmpDir = createTempDir();

  test("init --non-interactive --preset minimal writes wrangler.jsonc", () => {
    const proc = Bun.spawnSync(
      ["hoox", "init", "--non-interactive", "--preset", "minimal"],
      {
        cwd: tmpDir,
      }
    );
    expect(proc.exitCode).toBe(0);
    const config = JSON.parse(Bun.file(`${tmpDir}/wrangler.jsonc`).text());
    expect(config.workers).toHaveProperty("hoox");
  });

  afterAll(() => cleanupDir(tmpDir));
});
```

### Worker Binding Integration (`tests/integration/`)

Tests spin up Miniflare instances with 2+ workers and service bindings.

```typescript
import { Miniflare } from "miniflare";

const mf = new Miniflare({
  workers: [
    {
      name: "hoox",
      modules: true,
      scriptPath: "./workers/hoox/src/index.ts",
      bindings: { DB: { name: "d1-worker" } },
    },
    {
      name: "d1-worker",
      modules: true,
      scriptPath: "./workers/d1-worker/src/index.ts",
      serviceBindings: { DB: { name: "d1-worker" } },
    },
  ],
});

const res = await mf.dispatchFetch("http://localhost/webhook", {
  method: "POST",
  body: JSON.stringify({ type: "trade" }),
});
```

### Dashboard Integration (`workers/dashboard/test/integration/`)

Tests use mocked `env` bindings directly (no Miniflare needed since the dashboard
runs on Node.js via OpenNext adapter):

```typescript
import { describe, test, expect } from "bun:test";

// Mock the D1 binding
const mockDb = { prepare: () => ({ all: async () => [] }) };
const mockAnalytics = { query: async () => ({ data: [] }) };

// Test the handler directly with mocked env
const res = await handler({
  request,
  env: { DB: mockDb, ANALYTICS: mockAnalytics },
});
expect(res.status).toBe(200);
```

### Report Worker (`workers/report-worker/test/`)

Basic unit tests for PDF rendering — no Miniflare needed:

```typescript
const mockBrowser = {
  newPage: async () => ({
    setContent: async () => {},
    pdf: async () => Buffer.from("%PDF"),
  }),
};
const result = await generatePdf(mockBrowser, "<html></html>");
expect(result.contentType).toBe("application/pdf");
```

## E2E Test Architecture

### CLI Lifecycle (`tests/e2e/`)

Replace the placeholder `tests/e2e.test.ts` with real tests that run the
full CLI lifecycle in a temp workspace:

```
tests/e2e/
├── setup.ts          — createWorkspace(), cleanWorkspace()
├── cli-lifecycle.test.ts  — init → config → check
└── worker-http.test.ts    — Miniflare multi-worker (if feasible)
```

### Worker E2E (`tests/e2e/worker-http.test.ts`)

Spin up a Miniflare instance with gateway + mock handler, send real HTTP
requests, verify response chain. This tests the actual worker code paths,
not just isolated units.

## Priority Order

| Phase | Scope                                  | Dependencies                  |
| :---- | :------------------------------------- | :---------------------------- |
| **0** | Convert vitest → bun:test              | None                          |
| **1** | CLI integration + non-interactive flag | Phase 0                       |
| **2** | Worker binding integration             | Phase 0                       |
| **3** | Dashboard + report-worker              | Phase 0 (independent of 1, 2) |
| **4** | Root E2E + full flow                   | Phases 0, 1                   |

## Constraints

- **No Cloudflare credentials** in integration tests — all external APIs mocked
- **Temporary workspaces** cleaned up in `afterAll` hooks
- **No network calls** unless explicitly scoped (live tests)
- **Isolation** — each test phase runs independently, no shared state
- **bun:test only** — no vitest, no jest, no mocha
- **Miniflare only for binding tests** — unit tests don't need it
