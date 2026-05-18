# Integration & E2E Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill integration/E2E test gaps across CLI, workers, dashboard, and report-worker. Convert vitest to bun:test. Add non-interactive mode to `hoox init` for programmatic testing.

**Tech Stack:** bun:test (all tests), miniflare (direct API, no vitest), @clack/prompts (with non-interactive bypass).

**Spec:** `.opencode/specs/2026-05-18-integration-e2e-test-strategy-design.md`

---

## Task 0: Convert vitest → bun:test

**Files:**

- Delete: `vitest.config.ts`
- Modify: `package.json` (remove vitest deps, update scripts, add miniflare)
- Modify: `workers/analytics-worker/package.json` (remove stale vitest stanza)
- Modify: `workers/trade-worker/package.json` (remove stale vitest stanza)
- Modify: `tests/integration/gateway.test.ts` (rewrite to use bun:test + miniflare)
- Create: `tests/integration/setup.ts` (shared Miniflare runner)

- [ ] **Step 1: Add miniflare as devDependency**

  Add to `package.json` `devDependencies`:

  ```json
  "miniflare": "^4.20250508.0"
  ```

  (Match version from wrangler's transitive dep — check `bun pm ls` for current.)

- [ ] **Step 2: Remove vitest deps**

  Remove from `package.json` `devDependencies`:
  - `"vitest": "^4.1.6"`
  - `"@cloudflare/vitest-pool-workers": "^0.16.6"`

- [ ] **Step 3: Update scripts in package.json**

  ```json
  "test:integration": "bun test tests/integration/",
  "test:all": "bun run lint && bun run typecheck && bun run test && bun run test:integration && bun run test:live"
  ```

- [ ] **Step 4: Remove stale vitest stanzas**

  `workers/analytics-worker/package.json`: delete the `"vitest": { ... }` block.
  `workers/trade-worker/package.json`: delete the `"vitest": { ... }` block.

- [ ] **Step 5: Create shared Miniflare setup**

  `tests/integration/setup.ts`:

  ```typescript
  import { Miniflare } from "miniflare";
  import { describe, beforeAll, afterAll } from "bun:test";

  export function createIntegrationTestSuite() {
    let mf: Miniflare;

    beforeAll(async () => {
      mf = new Miniflare({
        workers: [
          {
            name: "hoox",
            modules: true,
            scriptPath: "./workers/hoox/src/index.ts",
            bindings: { IS_MINIFLARE: "true" },
          },
          {
            name: "trade-worker",
            modules: true,
            script: `export default { fetch: () => new Response(JSON.stringify({success: true})) }`,
          },
        ],
      });
    });

    afterAll(async () => {
      await mf?.dispose();
    });

    return { getMf: () => mf };
  }
  ```

- [ ] **Step 6: Rewrite gateway integration test**

  Rewrite `tests/integration/gateway.test.ts` to use `bun:test` + direct Miniflare
  imports instead of `vitest` + `cloudflare:test` module.

  Key changes:
  - Replace `import { describe, expect, it } from "vitest"` → `import { describe, expect, test } from "bun:test"`
  - Replace `import { env } from "cloudflare:test"` → use `mf.dispatchFetch()` directly
  - Replace `SELF` fetches → `mf.dispatchFetch()` calls
  - Keep same test logic and assertions, only change imports and lifecycle hooks

- [ ] **Step 7: Delete vitest.config.ts**

  ```bash
  rm vitest.config.ts
  ```

- [ ] **Step 8: Install and verify**

  ```bash
  bun install
  bun test tests/integration/   # should pass with rewritten test
  ```

- [ ] **Step 9: Run full suite**

  ```bash
  bun test    # all unit tests still pass
  bun run typecheck
  ```

- [ ] **Step 10: Commit**

  ```bash
  git add -A
  git commit -m "refactor(test): migrate from vitest to bun:test, remove vitest deps"
  ```

---

## Phase 1: CLI Integration + Non-Interactive Mode

### Task 1.1: Add --non-interactive flag to init command

**Files:**

- Modify: `packages/cli/src/commands/init/init-command.ts`
- Modify: `packages/cli/src/commands/init/types.ts` (add `--non-interactive` to InitOptions)
- Modify: `packages/cli/src/commands/init/init-command.test.ts` (add tests for new mode)

- [ ] **Step 1: Update InitOptions type**

  `packages/cli/src/commands/init/types.ts`:

  ```typescript
  export interface InitOptions {
    // ... existing fields ...
    nonInteractive?: boolean;
    accountId?: string;
    apiToken?: string;
    preset?: WorkerPresetName;
  }
  ```

- [ ] **Step 2: Register `--non-interactive` flag**

  In `init-command.ts` `registerInitCommand`:

  ```
  .option("--non-interactive, -n", "Run in non-interactive mode (requires --preset)")
  .option("--account-id <id>", "Cloudflare Account ID (non-interactive mode)")
  .option("--api-token <token>", "Cloudflare API Token (non-interactive mode)")
  .option("--preset <name>", "Worker preset: minimal|standard|full")
  ```

- [ ] **Step 3: Add non-interactive path in runInitCommand**

  In `runInitCommand`, gate the main flow:

  ```typescript
  if (options.nonInteractive) {
    return runNonInteractive(options, globalOpts);
  }
  return runInteractive(options, globalOpts); // existing logic
  ```

  `runNonInteractive` reads from flags or stdin JSON and feeds values
  directly into the WizardEngine without calling `@clack/prompts`.

- [ ] **Step 4: Add stdin JSON support**

  ```typescript
  function readStdinConfig(): InitOptions {
    const stdin = Bun.stdin.text();
    if (!stdin || stdin.trim().length === 0) return {};
    return JSON.parse(stdin);
  }
  ```

- [ ] **Step 5: Write tests for non-interactive mode**

  Add to `init-command.test.ts`:
  - Test: `--non-interactive --preset minimal` skips clack prompts
  - Test: `--non-interactive` with all flags produces correct config
  - Test: `--non-interactive` without required flags exits with error
  - Test: stdin JSON is parsed correctly

- [ ] **Step 6: Verify**

  ```bash
  bun test packages/cli/src/commands/init/
  bun run typecheck
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add packages/cli/src/commands/init/
  git commit -m "feat(cli): add --non-interactive flag to init command for programmatic testing"
  ```

### Task 1.2: Create CLI integration test infrastructure

**Files:**

- Create: `packages/cli/test/integration/setup.ts`
- Create: `packages/cli/test/integration/helpers.ts`

- [ ] **Step 1: Temp workspace helper**

  `packages/cli/test/integration/setup.ts`:

  ```typescript
  import { mkdtempSync, rmSync, writeFileSync } from "fs";
  import { join } from "path";
  import { tmpdir } from "os";

  export function createTempWorkspace(): string {
    const dir = mkdtempSync(join(tmpdir(), "hoox-test-"));
    // Create minimal wrangler.jsonc for commands that need it
    writeFileSync(
      join(dir, "wrangler.jsonc"),
      JSON.stringify({ global: {}, workers: {} })
    );
    return dir;
  }

  export function cleanupWorkspace(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
  }
  ```

- [ ] **Step 2: Helper assertions**

  `packages/cli/test/integration/helpers.ts`:

  ```typescript
  import { expect } from "bun:test";

  export function assertValidWranglerConfig(config: unknown): void { ... }
  export function assertWorkerEnabled(config: unknown, name: string): void { ... }
  ```

### Task 1.3: CLI pipeline integration tests

**Files:**

- Create: `packages/cli/test/integration/init-pipeline.test.ts`
- Create: `packages/cli/test/integration/config-pipeline.test.ts`
- Create: `packages/cli/test/integration/deploy-pipeline.test.ts`

- [ ] **Step 1: Init pipeline test**

  `init-pipeline.test.ts`:
  - Test: `init --non-interactive --preset minimal` writes `wrangler.jsonc` with hoox + d1-worker
  - Test: `init --non-interactive --preset standard` includes trade-worker + telegram integration
  - Test: `init --non-interactive --preset full` includes all workers
  - Test: `init` with custom preset + explicit workers list

- [ ] **Step 2: Config pipeline test**

  `config-pipeline.test.ts`:
  - Test: `config list` reads existing wrangler.jsonc
  - Test: `config env-command` validates env vars
  - Test: `kv-command` lists KV namespaces (via mock)

- [ ] **Step 3: Deploy pipeline test**

  `deploy-pipeline.test.ts`:
  - Test: `deploy --dry-run` lists expected workers
  - Test: `deploy` with missing config exits with error
  - Test: `deploy dashboard --list` shows dashboard URL

- [ ] **Step 4: Verify**

  ```bash
  bun test packages/cli/test/integration/
  bun test packages/cli/
  bun run typecheck
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/cli/test/integration/
  git commit -m "test(cli): add integration tests for init/config/deploy pipelines"
  ```

---

## Phase 2: Worker Binding Integration Tests

### Task 2.1: Update integration test infrastructure

- [ ] **Step 1: Update shared Miniflare setup**

  Update `tests/integration/setup.ts` to support multiple worker constellations
  (hoox+d1, trade-worker+d1, agent-worker+trade-worker+d1, etc.)

  Exports:

  ```typescript
  export function startMiniflare(
    workerConfigs: WorkerDef[]
  ): Promise<Miniflare>;
  export function stopMiniflare(mf: Miniflare): Promise<void>;
  export type WorkerDef = {
    name: string;
    scriptPath?: string;
    script?: string;
    bindings?: Record<string, unknown>;
  };
  ```

### Task 2.2: Gateway → D1 binding integration

**Files:**

- Modify: `tests/integration/gateway.test.ts` (already rewritten in Task 0; expand coverage)

- [ ] **Step 1: Expand gateway integration tests**
  - Test: POST `/webhook` with valid auth reaches d1-worker binding
  - Test: POST `/webhook` without auth returns 401
  - Test: POST `/webhook` with invalid body returns 400 (validation middleware)
  - Test: OPTIONS `/webhook` returns CORS headers
  - Test: rate limits after N requests in T seconds

### Task 2.3: Trade worker ↔ D1 integration

**Files:**

- Create: `tests/integration/trade-worker-d1.test.ts`

- [ ] **Step 1: Write trade-worker + d1-worker binding tests**
  - Test: trade-worker stores trade record via d1-worker binding
  - Test: trade-worker reads exchange config from d1-worker binding
  - Test: trade-worker queue handler persists to d1-worker
  - Test: trade-worker error handler logs errors to d1-worker

### Task 2.4: Agent worker ↔ Trade worker integration

**Files:**

- Create: `tests/integration/agent-trade.test.ts`

- [ ] **Step 1: Write agent-worker + trade-worker binding tests**
  - Test: agent-worker sends risk check request to trade-worker
  - Test: agent-worker stores risk assessment via d1-worker
  - Test: trade-worker rejects trades when agent risk score is high
  - Test: agent-worker cron handler processes pending assessments

- [ ] **Step 2: Verify all worker integration tests**

  ```bash
  bun test tests/integration/
  bun test
  bun run typecheck
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add tests/integration/
  git commit -m "test(workers): add service binding integration tests for all worker pairs"
  ```

---

## Phase 3: Dashboard + Report Worker Tests

### Task 3.1: Dashboard integration tests

**Files:**

- Create: `workers/dashboard/test/integration/setup.ts`
- Create: `workers/dashboard/test/integration/api-routes.test.ts`
- Create: `workers/dashboard/test/integration/dashboard-worker.test.ts`

- [ ] **Step 1: Create dashboard test setup**

  `workers/dashboard/test/integration/setup.ts` — mock bindings factory:

  ```typescript
  export function createMockEnv(): Env {
    return {
      DB: {
        prepare: () => ({ all: async () => [], first: async () => null }),
      },
      ANALYTICS: { query: async () => ({ data: [] }) },
      CONFIG_KV: { get: async () => null, put: async () => {} },
      // ... other bindings
    };
  }
  ```

- [ ] **Step 2: Write dashboard route tests**

  Test: `/api/config` returns merged config
  Test: `/api/trades` returns trade data (via mocked DB)
  Test: `/api/analytics` returns analytics (via mocked ANALYTICS binding)
  Test: error response when DB binding is down

- [ ] **Step 3: Write dashboard worker handler test**

  Test: handler routes to correct page based on URL path
  Test: 404 for unknown routes
  Test: static asset serving

### Task 3.2: Report worker unit tests

**Files:**

- Create: `workers/report-worker/test/report-worker.test.ts`

- [ ] **Step 1: Write report worker tests**
  - Test: handler returns PDF with correct Content-Type
  - Test: handler uses browser rendering API with correct params
  - Test: handler returns error when browser API unavailable
  - Test: handler rejects requests without required params

- [ ] **Step 2: Verify**

  ```bash
  bun test workers/dashboard/test/
  bun test workers/report-worker/test/
  bun test
  bun run typecheck
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add workers/dashboard/test/integration/ workers/report-worker/test/
  git commit -m "test: add dashboard integration tests and report-worker unit tests"
  ```

---

## Phase 4: Root E2E + Full Flow

### Task 4.1: Replace placeholder E2E test

**Files:**

- Modify: `tests/e2e.test.ts` → `tests/e2e/cli-lifecycle.test.ts`
- Create: `tests/e2e/setup.ts`

- [ ] **Step 1: Create E2E setup**

  `tests/e2e/setup.ts`:

  ```typescript
  export function createE2EWorkspace(): string { ... }
  export function cleanupE2EWorkspace(dir: string): void { ... }
  ```

- [ ] **Step 2: Write CLI lifecycle E2E**

  `tests/e2e/cli-lifecycle.test.ts`:
  - Test: `init --non-interactive --preset minimal` → `config list` → `check`
  - Test: `init --non-interactive --preset standard` produces correct worker list
  - Test: `init` with invalid preset exits with error code
  - Test: `init` → generated `wrangler.jsonc` is valid JSON with expected structure

### Task 4.2: Worker HTTP E2E (optional, Miniflare-based)

**Files:**

- Create: `tests/e2e/worker-http.test.ts`

- [ ] **Step 1: Write Miniflare-based worker E2E**
  - Test: HTTP POST to gateway → auth passes → route to handler → response
  - Test: HTTP GET to health endpoint returns 200
  - Test: HTTP POST with invalid body returns validation error

- [ ] **Step 2: Verify all E2E tests**

  ```bash
  bun test tests/e2e/
  bun test
  bun run lint
  bun run typecheck
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add tests/e2e/
  git commit -m "test(e2e): add CLI lifecycle E2E tests and worker HTTP E2E"
  ```

---

## Task 5: Final Verification & Review

- [ ] **Step 1: Run full lint**

  ```bash
  bun run lint
  ```

  Expected: Pass

- [ ] **Step 2: Run full typecheck**

  ```bash
  bun run typecheck
  ```

  Expected: Pass

- [ ] **Step 3: Run all tests**

  ```bash
  bun run test
  ```

  Expected: All unit + integration tests pass

- [ ] **Step 4: Run build check**

  ```bash
  bun run build
  ```

  Expected: Pass

- [ ] **Step 5: Run integration tests explicitly**

  ```bash
  bun test tests/integration/
  ```

  Expected: All integration tests pass (no vitest involved)

- [ ] **Step 6: Review commit log**

  ```bash
  git log --oneline -10
  ```

  Expected: Clean, logical commits per task

- [ ] **Step 7: Final commit (if any remaining uncommitted changes)**

  ```bash
  git add -A
  git commit -m "chore: final integration and E2E test coverage"
  ```
