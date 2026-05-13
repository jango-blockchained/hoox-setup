/**
 * Unit tests for health check handler
 * Run with: bun test packages/shared/tests/health.test.ts
 */

import { describe, test, expect } from "bun:test";
import { healthCheck } from "../src/health";

describe("healthCheck", () => {
  test("returns 200 status code", () => {
    const res = healthCheck();
    expect(res.status).toBe(200);
  });

  test("returns JSON with Content-Type header", () => {
    const res = healthCheck();
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  test("includes success: true in response body", async () => {
    const res = healthCheck();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("includes status 'ok' in result", async () => {
    const res = healthCheck();
    const body = await res.json();
    expect(body.result.status).toBe("ok");
  });

  test("includes timestamp in result", async () => {
    const res = healthCheck();
    const body = await res.json();
    expect(body.result.timestamp).toBeDefined();
    // Timestamp should be a valid ISO string
    expect(() => new Date(body.result.timestamp)).not.toThrow();
    expect(new Date(body.result.timestamp).toISOString()).toBe(
      body.result.timestamp
    );
  });

  test("includes service name when worker option is provided", async () => {
    const res = healthCheck({ worker: "trade-worker" });
    const body = await res.json();
    expect(body.result.service).toBe("trade-worker");
  });

  test("includes version when version option is provided", async () => {
    const res = healthCheck({ version: "1.2.3" });
    const body = await res.json();
    expect(body.result.version).toBe("1.2.3");
  });

  test("includes details when details option is provided", async () => {
    const details = { dbStatus: "connected", queueSize: 42 };
    const res = healthCheck({ details });
    const body = await res.json();
    expect(body.result.details).toEqual(details);
  });

  test("works without options (all optional fields absent)", async () => {
    const res = healthCheck();
    const body = await res.json();

    expect(body.result.status).toBe("ok");
    expect(body.result.timestamp).toBeDefined();
    expect(body.result.service).toBeUndefined();
    expect(body.result.version).toBeUndefined();
    expect(body.result.details).toBeUndefined();
  });
});
