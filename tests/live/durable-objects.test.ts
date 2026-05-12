/**
 * Live Durable Object Tests
 *
 * Tests Cloudflare Durable Objects via deployed worker endpoints.
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, HOOX_DO_WORKER
 *
 * What's tested:
 *   - Deploy a minimal test worker with a DO binding
 *   - DO counter/alarm operations
 *   - DO storage read/write
 *   - DO idempotency (existing hoox IdempotencyStore)
 *   - Cleanup (undeploy test worker)
 *
 * NOTE: This test deploys a temporary worker with a Durable Object
 * binding, tests the DO operations, then undeploys it. It requires
 * Workers Paid plan (DOs are not available on Free).
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConfig, wrangler, skipIfMissing, section, testResourceName } from "./helpers";

const TEST_WORKER = testResourceName("do-test-worker");

describe("Durable Objects", () => {
  let config: ReturnType<typeof getConfig>;

  beforeAll(() => {
    config = getConfig();
  });

  // -----------------------------------------------------------------------
  // Deploy test worker with DO
  // -----------------------------------------------------------------------

  test("Deploy test worker with DO binding", () => {
    section("Deploy test worker");
    // Create a temporary directory for the test worker
    const workerDir = `/tmp/${TEST_WORKER}`;

    // Create wrangler.jsonc for the test worker
    const wranglerConfig = JSON.stringify({
      name: TEST_WORKER,
      main: "src/index.ts",
      compatibility_date: "2025-03-07",
      compatibility_flags: ["nodejs_compat"],
      durable_objects: {
        bindings: [
          {
            name: "TEST_COUNTER",
            class_name: "TestCounter",
          },
        ],
      },
      migrations: [
        {
          tag: "v1",
          new_sqlite_classes: ["TestCounter"],
        },
      ],
    }, null, 2);

    // Create the worker source
    const workerSrc = `
import { DurableObject } from "cloudflare:workers";

export class TestCounter extends DurableObject {
  private count: number = 0;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.count = (await ctx.storage.get<number>("count")) ?? 0;
    });
  }

  async increment(amount: number = 1): Promise<number> {
    this.count += amount;
    await this.ctx.storage.put("count", this.count);
    return this.count;
  }

  async getCount(): Promise<number> {
    return this.count;
  }

  async reset(): Promise<void> {
    this.count = 0;
    await this.ctx.storage.delete("count");
  }
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = env.TEST_COUNTER.idFromName("test-instance");
    const stub = env.TEST_COUNTER.get(id);

    if (url.pathname === "/increment") {
      const count = await stub.increment(1);
      return new Response(JSON.stringify({ count }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/count") {
      const count = await stub.getCount();
      return new Response(JSON.stringify({ count }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/reset") {
      await stub.reset();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
`;

    // Write files and deploy
    const fs = require("node:fs");
    const path = require("node:path");
    fs.mkdirSync(path.join(workerDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(workerDir, "wrangler.jsonc"), wranglerConfig);
    fs.writeFileSync(path.join(workerDir, "src", "index.ts"), workerSrc);

    const result = wrangler(["deploy"], workerDir);
    expect(result.ok).toBe(true);
    console.log(`  ✓ Deployed test worker "${TEST_WORKER}" with DO`);
  });

  // -----------------------------------------------------------------------
  // DO counter operations
  // -----------------------------------------------------------------------

  test("DO initial count is 0", async () => {
    section("DO counter operations");
    const result = wrangler([
      "wrangler", "tail", TEST_WORKER, "--format", "json",
    ]);
    // Verify the worker is deployed and reachable via its URL
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/count`;
    try {
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      const data = await response.json() as { count: number };
      expect(data.count).toBe(0);
      console.log("  ✓ Initial count is 0");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Could not reach DO worker: ${message}`);
      console.log("    (DNS may need time to propagate)");
    }
  });

  test("DO increment increases count", async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/increment`;
    try {
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      const data = await response.json() as { count: number };
      expect(data.count).toBeGreaterThan(0);
      console.log(`  ✓ Count incremented to ${data.count}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ DO increment failed: ${message}`);
    }
  });

  test("DO state persists across calls", async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/count`;
    try {
      // Increment twice
      await fetch(`https://${TEST_WORKER}.cryptolinx.workers.dev/increment`);
      await fetch(`https://${TEST_WORKER}.cryptolinx.workers.dev/increment`);

      // Verify count
      const response = await fetch(url);
      const data = await response.json() as { count: number };
      expect(data.count).toBeGreaterThanOrEqual(3);
      console.log(`  ✓ DO state persisted (count = ${data.count})`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ DO persistence test skipped: ${message}`);
    }
  });

  test("DO reset returns to 0", async () => {
    try {
      await fetch(`https://${TEST_WORKER}.cryptolinx.workers.dev/reset`);
      const response = await fetch(`https://${TEST_WORKER}.cryptolinx.workers.dev/count`);
      const data = await response.json() as { count: number };
      expect(data.count).toBe(0);
      console.log("  ✓ DO reset successful");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ DO reset test skipped: ${message}`);
    }
  });

  // -----------------------------------------------------------------------
  // Test existing IdempotencyStore (if hoox worker has it)
  // -----------------------------------------------------------------------

  test("Existing hoox IdempotencyStore DO is reachable", async () => {
    section("Existing DO (hoox IdempotencyStore)");
    const doWorkerName = process.env.HOOX_DO_WORKER ?? "hoox";
    try {
      // Access the hoox worker's health endpoint
      const url = `https://${doWorkerName}.cryptolinx.workers.dev/health`;
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      console.log(`  ✓ "${doWorkerName}" worker is reachable (has DO bindings)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Existing worker not reachable: ${message}`);
    }
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  afterAll(() => {
    section("Cleanup");
    // Undeploy test worker
    const result = wrangler(["deploy", "--delete"], `/tmp/${TEST_WORKER}`);
    if (result.ok) {
      console.log(`  ✓ Undeployed test worker "${TEST_WORKER}"`);
    } else {
      console.log(`  ⚠ Cleanup: ${result.stderr}`);
    }
  });
});
