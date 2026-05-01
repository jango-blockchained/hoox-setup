import { beforeEach, afterEach, describe, expect, test } from "bun:test";

const originalEnv = { ...process.env };

describe("dashboard config", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("throws when SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;

    await expect(import("../src/lib/config")).rejects.toThrow(
      "Missing required environment variable: SESSION_SECRET"
    );
  });
});
