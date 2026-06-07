/**
 * Consolidated test setup / preload for the HOOX monorepo.
 *
 * This file replaces the four near-identical preloads that previously lived at:
 *   - workers/hoox/test/setup.ts
 *   - workers/email-worker/test/setup.ts
 *   - workers/telegram-worker/test/setup.ts
 *   - workers/report-worker/test/setup.ts
 *
 * It is wired in via `bunfig.toml`:
 *   preload = "./packages/test-utils/src/setup.ts"
 *
 * What it does (consolidated contract — do not remove any of these without
 * updating every worker/package that depends on the implicit globals):
 *
 *   1. Promotes `expect`, `jest`, `test`, `describe`, `beforeEach`,
 *      `afterEach` from `bun:test` to the global scope so existing tests
 *      that use the Jest-style globals keep working.
 *   2. Re-publishes the WHATWG fetch primitives (`Response`, `Request`,
 *      `Headers`) on the global object so they are reachable in every
 *      test file regardless of how it was loaded.
 *   3. Mocks the `cloudflare:workers` workerd module (not available in
 *      `bun test`) with a `DurableObject` base class that captures
 *      `ctx` and `state`. This is critical for edge-runtime test
 *      compatibility — without it, every `import "cloudflare:workers"`
 *      in worker source would fail to resolve under bun.
 *   4. Ensures the `./reports/` directory exists so Bun's JUnit reporter
 *      (configured in `bunfig.toml`) can flush `./reports/junit.xml`
 *      without a missing-directory error. The reporter is post-processed
 *      by `scripts/test-with-table.ts` to render the unified per-suite
 *      summary table — see that file for the runtime flow.
 */
import {
  expect,
  jest,
  test,
  describe,
  beforeEach,
  afterEach,
  mock,
} from "bun:test";
import { installSpawnShim } from "./spawn-shim";
installSpawnShim();
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── 1. Jest-style globals ────────────────────────────────────────────────────
//
// Expose bun:test's named exports on `globalThis` so test files written in
// the older "Jest-style" (no top-level `import { describe, ... } from
// "bun:test"`) keep working unchanged.
Object.assign(global, {
  expect,
  jest,
  test,
  describe,
  beforeEach,
  afterEach,
});

// ── 2. WHATWG fetch primitives on the global scope ──────────────────────────
//
// `bun test` already provides these on the runtime, but pinning them to
// `globalThis` makes them reachable from every test file even when the test
// runs through isolated module sandboxes.
global.Response = Response;
global.Request = Request;
global.Headers = Headers;

// ── 3. Mock the workerd `cloudflare:workers` module ─────────────────────────
//
// `cloudflare:workers` is a workerd-only built-in. In a `bun test` environment
// the module specifier does not resolve, so we replace it with a stub
// `DurableObject` class. Worker code that extends `DurableObject` from
// `cloudflare:workers` will inherit this stub at test time.
//
// The shape mirrors the previous `workers/hoox/test/setup.ts` payload
// verbatim: a class that stores `ctx` and `state` on the instance. This is
// the minimum surface the existing tests rely on; richer storage
// stubbing is provided separately by `workers/hoox/test/mocks/cloudflare-workers.ts`
// for tests that opt in.
mock.module("cloudflare:workers", () => ({
  DurableObject: class MockDurableObject {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: any;
    constructor(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: any
    ) {
      this.ctx = ctx;
      this.state = state;
    }
  },
}));

// ── 4. Ensure the JUnit output directory exists ─────────────────────────────
//
// `bunfig.toml` configures Bun's JUnit reporter to write to
// `./reports/junit.xml`. The reporter does not auto-create the directory,
// so we create it once at preload load (runs in every test process, before
// any test starts). The file itself is post-processed by
// `scripts/test-with-table.ts` to render the unified per-suite summary
// table at the end of each `bun run test*` invocation.
function findRepoRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(resolve(current, "bunfig.toml"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

const setupDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(setupDir);
const reportsDir = resolve(repoRoot, "reports");
mkdirSync(reportsDir, { recursive: true });
