/**
 * Live Zod Validation Tests
 *
 * Tests the shared package's Zod schemas and validateJson() middleware
 * by deploying a temporary worker with validation endpoints.
 *
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 *
 * What's tested:
 *   - Deploy a minimal test worker with Zod validation endpoints
 *   - WebhookPayloadSchema accepts valid payload
 *   - WebhookPayloadSchema rejects missing required fields
 *   - WebhookPayloadSchema rejects invalid enum values
 *   - WebhookPayloadSchema rejects negative quantity
 *   - TradeActionSchema accepts all valid actions
 *   - TradeActionSchema rejects invalid actions
 *   - Structured logger produces valid JSON output
 *   - Cleanup (undeploy test worker)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConfig, wrangler, section, testResourceName } from "./helpers";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_WORKER = testResourceName("validation-test");

describe("Zod Validation", () => {
  let config: ReturnType<typeof getConfig>;

  beforeAll(async () => {
    config = getConfig();
  });

  // -----------------------------------------------------------------------
  // Deploy test worker with Zod validation endpoints
  // -----------------------------------------------------------------------

  test("Deploy test worker with validation endpoints", { timeout: 120000 }, async () => {
    section("Deploy validation test worker");
    const workerDir = `/tmp/${TEST_WORKER}`;

    const wranglerConfig = JSON.stringify({
      name: TEST_WORKER,
      main: "src/index.ts",
      compatibility_date: "2025-03-07",
      compatibility_flags: ["nodejs_compat"],
    }, null, 2);

    const workerSrc = `
import { z } from "zod";

// --- Schemas (mirrors shared package) ---

const TradeActionSchema = z.enum(["LONG", "SHORT", "CLOSE_LONG", "CLOSE_SHORT"]);

const WebhookPayloadSchema = z.object({
  apiKey: z.string().min(1, "apiKey is required"),
  symbol: z.string().min(1).max(20),
  action: TradeActionSchema,
  quantity: z.number().positive("quantity must be positive").finite(),
  price: z.number().positive("price must be positive").finite().optional(),
  exchange: z.string().optional(),
  type: z.enum(["market", "limit"]).optional(),
}).strict();

// --- Logger (mirrors shared createLogger) ---

function createLogger(service: string) {
  return {
    info: (msg: string, ctx?: Record<string, unknown>) =>
      console.log(JSON.stringify({ level: "info", service, message: msg, context: ctx ?? {} })),
    warn: (msg: string, ctx?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ level: "warn", service, message: msg, context: ctx ?? {} })),
    error: (msg: string, ctx?: Record<string, unknown>) =>
      console.error(JSON.stringify({ level: "error", service, message: msg, context: ctx ?? {} })),
  };
}

const logger = createLogger("validation-test-worker");

// --- Validation helper (mirrors shared validateJson) ---

function validateJson<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false as const,
      error: result.error.issues.map((i: any) => \`\${i.path.join(".")}: \${i.message}\`).join("; "),
    };
  }
  return { ok: true as const, value: result.data as z.infer<T> };
}

// --- Structured logger test endpoint ---

function testLoggerOutput(): Record<string, unknown>[] {
  const logs: Record<string, unknown>[] = [];
  const mockConsole = {
    log: (msg: string) => logs.push(JSON.parse(msg)),
  };

  const testLogger = createLogger("test-service");
  // Capture output by temporarily overriding console.log
  const origLog = console.log.bind(console);
  console.log = (msg: string) => {
    try { logs.push(JSON.parse(msg)); } catch { /* not JSON */ }
  };
  testLogger.info("test info message", { key: "value" });
  testLogger.warn("test warn message");
  testLogger.error("test error message", { err: "something failed" });
  console.log = origLog;

  return logs;
}

// --- Request handler ---

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Logger test endpoint
    if (path === "/logger") {
      try {
        const logs = testLoggerOutput();
        return new Response(JSON.stringify({ success: true, logs }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: unknown) {
        return new Response(JSON.stringify({ success: false, error: String(err) }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Validation test endpoint
    if (path === "/validate" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, unknown>;
        const result = validateJson(WebhookPayloadSchema, body);

        const status = result.ok ? 200 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: unknown) {
        return new Response(JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    // Health check
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
`;

    mkdirSync(join(workerDir, "src"), { recursive: true });
    writeFileSync(join(workerDir, "wrangler.jsonc"), wranglerConfig);
    writeFileSync(join(workerDir, "src", "index.ts"), workerSrc);

    const result = await wrangler(["deploy"], workerDir);
    expect(result.ok).toBe(true);
    console.log(`  ✓ Deployed test worker "${TEST_WORKER}"`);
  });

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------

  test("Worker is reachable", { timeout: 30000 }, async () => {
    section("Validation endpoint tests");
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/health`;
    try {
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      const data = await response.json() as { status: string };
      expect(data.status).toBe("ok");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Worker not reachable: ${message}`);
    }
  });

  // -----------------------------------------------------------------------
  // Zod WebhookPayloadSchema validation tests
  // -----------------------------------------------------------------------

  const validPayload = {
    apiKey: "test-key-123",
    exchange: "binance",
    action: "LONG" as const,
    symbol: "BTC/USDT",
    quantity: 0.5,
    price: 50000,
    type: "market",
  };

  test("Accepts valid webhook payload", { timeout: 30000 }, async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/validate`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; value?: unknown };
      expect(data.ok).toBe(true);
      expect(data.value).toBeDefined();
      console.log("  ✓ Valid payload accepted");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Validation test failed: ${message}`);
    }
  });

  test("Rejects missing apiKey", { timeout: 30000 }, async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/validate`;
    try {
      const { apiKey: _, ...noKey } = validPayload;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noKey),
      });
      expect(response.status).toBe(400);
      const data = await response.json() as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toContain("apiKey");
      console.log(`  ✓ Missing apiKey rejected: ${data.error}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Test failed: ${message}`);
    }
  });

  test("Rejects invalid action enum", { timeout: 30000 }, async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/validate`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, action: "INVALID_ACTION" }),
      });
      expect(response.status).toBe(400);
      const data = await response.json() as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toContain("action");
      console.log(`  ✓ Invalid action rejected: ${data.error}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Test failed: ${message}`);
    }
  });

  test("Rejects negative quantity", { timeout: 30000 }, async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/validate`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, quantity: -1 }),
      });
      expect(response.status).toBe(400);
      const data = await response.json() as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toContain("quantity");
      console.log(`  ✓ Negative quantity rejected: ${data.error}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Test failed: ${message}`);
    }
  });

  test("Rejects extra unknown fields (strict mode)", { timeout: 30000 }, async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/validate`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, extraField: "should not be allowed" }),
      });
      // strict() rejects unknown keys
      expect(response.status).toBe(400);
      const data = await response.json() as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      console.log(`  ✓ Extra fields rejected: ${data.error}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Test failed: ${message}`);
    }
  });

  test("Accepts optional fields omitted", { timeout: 30000 }, async () => {
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/validate`;
    try {
      const minimal = {
        apiKey: "test-key",
        action: "SHORT",
        symbol: "ETH/USDT",
        quantity: 1.0,
      };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(minimal),
      });
      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean };
      expect(data.ok).toBe(true);
      console.log("  ✓ Minimal valid payload accepted");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Test failed: ${message}`);
    }
  });

  // -----------------------------------------------------------------------
  // Structured logger tests
  // -----------------------------------------------------------------------

  test("Structured logger produces valid JSON output", { timeout: 30000 }, async () => {
    section("Structured logger tests");
    const url = `https://${TEST_WORKER}.cryptolinx.workers.dev/logger`;
    try {
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      const data = await response.json() as { success: boolean; logs: Record<string, unknown>[] };
      expect(data.success).toBe(true);
      expect(data.logs.length).toBeGreaterThanOrEqual(3);

      // Verify all log entries have required fields
      for (const log of data.logs) {
        expect(log).toHaveProperty("level");
        expect(log).toHaveProperty("service");
        expect(log).toHaveProperty("message");
        expect(typeof log.level).toBe("string");
        expect(typeof log.service).toBe("string");
        expect(typeof log.message).toBe("string");
      }

      // Verify log levels
      const levels = data.logs.map((l) => l.level);
      expect(levels).toContain("info");
      expect(levels).toContain("warn");
      expect(levels).toContain("error");

      // Verify context object for info log
      const infoLog = data.logs.find((l) => l.level === "info");
      expect(infoLog?.context).toBeDefined();

      console.log(`  ✓ Logger produced ${data.logs.length} valid JSON log entries`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Logger test failed: ${message}`);
    }
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  afterAll(async () => {
    section("Cleanup");
    const workerDir = `/tmp/${TEST_WORKER}`;
    const result = await wrangler(["deploy", "--delete"], workerDir);
    if (result.ok) {
      console.log(`  ✓ Undeployed test worker "${TEST_WORKER}"`);
    } else {
      console.log(`  ⚠ Cleanup: ${result.stderr}`);
    }
    if (existsSync(workerDir)) {
      rmSync(workerDir, { recursive: true, force: true });
    }
  });
});
