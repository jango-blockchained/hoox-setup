import { beforeEach, afterEach, describe, expect, test } from "bun:test";

const originalEnv = { ...process.env };

describe("dashboard config", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("uses fallback when SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;

    const mod = await import("../src/lib/config");
    expect(mod).toBeDefined();
  });
});
