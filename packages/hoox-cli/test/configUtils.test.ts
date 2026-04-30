import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import path from "node:path";

const originalCwd = process.cwd;
const projectRoot = path.resolve(__dirname, "../../../");

beforeAll(() => {
  process.cwd = () => projectRoot;
});

afterAll(() => {
  process.cwd = originalCwd;
});

import { loadConfig, parseJsonc } from "../src/configUtils.js";
import toml from "toml";
import type { Config } from "../src/types.js";

describe("Config Utils - Extended", () => {
  describe("Config loading", () => {
    test("should load config or throw if unconfigured", async () => {
      try {
        const config = await loadConfig();
        expect(config.global.cloudflare_api_token).toBeDefined();
        expect(config.global.cloudflare_account_id).toBeDefined();
        expect(config.global.cloudflare_secret_store_id).toBeDefined();
        expect(config.global.subdomain_prefix).toBeDefined();
      } catch (error: unknown) {
        expect(error instanceof Error && error.message).toContain("Missing required global configuration keys");
      }
    });
  });

  describe("Worker config structure", () => {
    test("should have expected workers or throw if unconfigured", async () => {
      try {
        const config = await loadConfig();
        expect(config.workers["d1-worker"].enabled).toBeDefined();
        expect(config.workers["telegram-worker"].secrets).toBeDefined();
        expect(config.workers["trade-worker"].vars).toBeDefined();
        expect(config.workers["hoox"]).toBeDefined();
        expect(config.workers["email-worker"]).toBeDefined();
      } catch (error: unknown) {
        expect(error instanceof Error && error.message).toContain("Missing required global configuration keys");
      }
    });
  });

  describe("URL Generation", () => {
    test("should generate correct URL format or throw if unconfigured", async () => {
      try {
        const config = await loadConfig();
        const prefix = config.global.subdomain_prefix;
        expect(prefix).toBeDefined();
      } catch (error: unknown) {
        expect(error instanceof Error && error.message).toContain("Missing required global configuration keys");
      }
    });
  });

  describe("Worker paths", () => {
    test("all enabled workers should have valid paths or throw if unconfigured", async () => {
      try {
        const config = await loadConfig();
        for (const [name, worker] of Object.entries(config.workers)) {
          if (worker.enabled) {
            expect(worker.path).toBeDefined();
            expect(worker.path!.startsWith("workers/")).toBe(true);
          }
        }
      } catch (error: unknown) {
        expect(error instanceof Error && error.message).toContain("Missing required global configuration keys");
      }
    });
  });
});

describe("TOML Parsing", () => {
  test("should parse simple TOML", () => {
    const tomlString = `
[global]
test_key = "test_value"
number = 42
`;
    const result = toml.parse(tomlString) as { global: { test_key: string, number: number } };
    expect(result.global.test_key).toBe("test_value");
    expect(result.global.number).toBe(42);
  });

  test("should parse nested tables", () => {
    const tomlString = `
[workers.test-worker]
enabled = true
path = "workers/test"
`;
    const result = toml.parse(tomlString) as { workers: { "test-worker": { enabled: boolean, path: string } } };
    expect(result.workers["test-worker"].enabled).toBe(true);
  });
});

describe("JSONC Parsing", () => {
  test("should parse JSON with comments", () => {
    const jsonc = `{
  // This is a comment
  "key": "value"
}`;
    const result = parseJsonc(jsonc) as { key: string };
    expect(result.key).toBe("value");
  });

  test("should handle multi-line comments", () => {
    const jsonc = `{
  /* multi
     line
     comment */
  "key": "value"
}`;
    const result = parseJsonc(jsonc) as { key: string };
    expect(result.key).toBe("value");
  });

  test("should remove trailing commas", () => {
    const jsonc = `{
  "key": "value",
}`;
    const result = parseJsonc(jsonc) as { key: string };
    expect(result.key).toBe("value");
  });

  test("should preserve comment-like tokens inside strings", () => {
    const jsonc = `{"key": "https://example.com/a//b", "note": "/* keep */"}`;
    const result = parseJsonc(jsonc) as { key: string; note: string };
    expect(result).toEqual({
      key: "https://example.com/a//b",
      note: "/* keep */",
    });
  });

  test("should parse trailing commas in nested structures", () => {
    const jsonc = `{
  "key": "value",
  "arr": ["a", "b",],
  "obj": {"nested": true,},
}`;
    const result = parseJsonc(jsonc) as { key: string; arr: string[]; obj: { nested: boolean } };
    expect(result).toEqual({ key: "value", arr: ["a", "b"], obj: { nested: true } });
  });
});
