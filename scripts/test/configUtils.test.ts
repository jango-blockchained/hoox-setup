import { describe, expect, test, beforeEach } from "bun:test";
import { loadConfig, saveConfig, parseJsonc } from "../configUtils";
import toml from "toml";

describe("Config Utils - Extended", () => {
  describe("Config loading", () => {
    test("should load global cloudflare_api_token", async () => {
      const config = await loadConfig();
      expect(config.global.cloudflare_api_token).toBeDefined();
    });

    test("should load global cloudflare_account_id", async () => {
      const config = await loadConfig();
      expect(config.global.cloudflare_account_id).toBeDefined();
    });

    test("should load global cloudflare_secret_store_id", async () => {
      const config = await loadConfig();
      expect(config.global.cloudflare_secret_store_id).toBeDefined();
    });

    test("should load global subdomain_prefix", async () => {
      const config = await loadConfig();
      expect(config.global.subdomain_prefix).toBeDefined();
    });
  });

  describe("Worker config structure", () => {
    test("should have d1-worker with enabled flag", async () => {
      const config = await loadConfig();
      expect(config.workers["d1-worker"]).toBeDefined();
      expect(typeof config.workers["d1-worker"].enabled).toBe("boolean");
    });

    test("should have telegram-worker with secrets", async () => {
      const config = await loadConfig();
      const worker = config.workers["telegram-worker"];
      expect(worker).toBeDefined();
      expect(Array.isArray(worker.secrets)).toBe(true);
    });

    test("should have trade-worker with vars", async () => {
      const config = await loadConfig();
      const worker = config.workers["trade-worker"];
      expect(worker).toBeDefined();
      expect(typeof worker.vars).toBe("object");
    });

    test("should have hoox worker", async () => {
      const config = await loadConfig();
      expect(config.workers["hoox"]).toBeDefined();
    });

    test("should have email-worker", async () => {
      const config = await loadConfig();
      expect(config.workers["email-worker"]).toBeDefined();
    });
  });

  describe("URL Generation", () => {
    test("should generate correct URL format", async () => {
      const config = await loadConfig();
      const prefix = config.global.subdomain_prefix;
      const url = `https://telegram-worker.${prefix}.workers.dev`;
      expect(url).toMatch(/^https:\/\/.+\.workers\.dev$/);
    });
  });

  describe("Worker paths", () => {
    test("all enabled workers should have valid paths", async () => {
      const config = await loadConfig();
      for (const [name, worker] of Object.entries(config.workers)) {
        if (worker.enabled) {
          expect(worker.path).toBeDefined();
          expect(worker.path.startsWith("workers/")).toBe(true);
        }
      }
    });
  });
});

describe("TOML Parsing", () => {
  test("should parse simple TOML", () => {
    const toml = `
[global]
test_key = "test_value"
number = 42
`;
    const result = toml.parse(toml);
    expect(result.global.test_key).toBe("test_value");
    expect(result.global.number).toBe(42);
  });

  test("should parse nested tables", () => {
    const toml = `
[workers.test-worker]
enabled = true
path = "workers/test"
`;
    const result = toml.parse(toml);
    expect(result.workers["test-worker"].enabled).toBe(true);
  });
});

describe("JSONC Parsing", () => {
  test("should parse JSON with comments", () => {
    const jsonc = `{
  // This is a comment
  "key": "value"
}`;
    const result = parseJsonc(jsonc);
    expect(result.key).toBe("value");
  });

  test("should handle multi-line comments", () => {
    const jsonc = `{
  /* multi
     line
     comment */
  "key": "value"
}`;
    const result = parseJsonc(jsonc);
    expect(result.key).toBe("value");
  });

  test("should remove trailing commas", () => {
    const jsonc = `{
  "key": "value",
}`;
    const result = parseJsonc(jsonc);
    expect(result.key).toBe("value");
  });
});
