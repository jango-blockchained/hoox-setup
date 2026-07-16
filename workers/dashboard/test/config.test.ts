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

  test("allows AUTH_TYPE=none in development", async () => {
    process.env.AUTH_TYPE = "none";
    const env = process.env as Record<string, string | undefined>;
    const prevNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";

    try {
      const { assertProductionAuthConfigured } =
        await import("../src/lib/config");
      expect(() => assertProductionAuthConfigured()).not.toThrow();
    } finally {
      env.NODE_ENV = prevNodeEnv;
    }
  });

  test("rejects AUTH_TYPE=none in production", async () => {
    process.env.AUTH_TYPE = "none";
    const env = process.env as Record<string, string | undefined>;
    const prevNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "production";

    try {
      const { assertProductionAuthConfigured } =
        await import("../src/lib/config");
      expect(() => assertProductionAuthConfigured()).toThrow(/not permitted/);
    } finally {
      env.NODE_ENV = prevNodeEnv;
    }
  });
});
