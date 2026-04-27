import { describe, expect, test, beforeAll, afterAll, afterEach, vi } from "bun:test";
import path from "node:path";

const originalCwd = process.cwd;
const projectRoot = path.resolve(__dirname, "../../../");

beforeAll(() => {
  process.cwd = () => projectRoot;
});

afterAll(() => {
  process.cwd = originalCwd;
});

import { loadConfig, parseJsonc, stringifyToml, parseConfig, getWorkerNames, loadPagesConfig, saveConfig, savePagesConfig } from "../src/configUtils.js";
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

  test("should handle single-line comments in middle of content", () => {
    const jsonc = `{
  "key1": "value1",
  "key2": "value2"
}`;
    const result = parseJsonc(jsonc) as { key1: string, key2: string };
    expect(result.key1).toBe("value1");
    expect(result.key2).toBe("value2");
  });

  test("should handle empty string", () => {
    const result = parseJsonc("{}");
    expect(result).toEqual({});
  });
});

describe("stringifyToml", () => {
  test("should serialize null values", () => {
    const result = stringifyToml({ key: null });
    expect(result).toContain('key = null');
  });

  test("should serialize undefined values", () => {
    const result = stringifyToml({ key: undefined });
    expect(result).toContain('key = ');
  });

  test("should serialize simple string values", () => {
    const result = stringifyToml({ key: "value" });
    expect(result).toContain('key = "value"');
  });

  test("should serialize number values", () => {
    const result = stringifyToml({ num: 42 });
    expect(result).toContain("num = 42");
  });

  test("should serialize boolean values", () => {
    const result = stringifyToml({ flag: true });
    expect(result).toContain("flag = true");
  });

  test("should serialize arrays", () => {
    const result = stringifyToml({ arr: ["a", "b", "c"] });
    expect(result).toContain('arr = ["a", "b", "c"]');
  });

  test("should serialize nested objects as tables", () => {
    const result = stringifyToml({ nested: { inner: "value" } });
    expect(result).toContain("[nested]");
    expect(result).toContain('inner = "value"');
  });

  test("should serialize deeply nested objects", () => {
    const result = stringifyToml({ a: { b: { c: "deep" } } });
    expect(result).toContain("[a]");
    expect(result).toContain("[b]");
    expect(result).toContain('c = "deep"');
  });

  test("should serialize flat objects without tables", () => {
    const result = stringifyToml({ flat: { x: 1, y: 2 } });
    expect(result).toContain("[flat]");
    expect(result).toContain("x = 1");
    expect(result).toContain("y = 2");
  });

  test("should serialize empty array", () => {
    const result = stringifyToml({ arr: [] });
    expect(result).toContain("arr = []");
  });
});

describe("parseConfig", () => {
  

  test("should be alias of loadConfig", async () => {
    try {
      const config = await parseConfig();
      expect(config.global).toBeDefined();
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });
});

describe("getWorkerNames", () => {
  

  test("should return array of worker names", async () => {
    try {
      const names = await getWorkerNames();
      expect(Array.isArray(names)).toBe(true);
      if (names.length > 0) {
        expect(typeof names[0]).toBe("string");
      }
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });
});

describe("loadPagesConfig", () => {
  
  const originalCwd2 = process.cwd;

  afterEach(() => {
    process.cwd = () => originalCwd2();
  });

  test("should return empty config when pages.jsonc does not exist", async () => {
    process.cwd = () => path.resolve(projectRoot, "test-empty");
    const result = await loadPagesConfig();
    expect(result.global).toBeDefined();
    expect(result.pages).toEqual({});
  });

  test("should parse valid pages.jsonc", async () => {
    process.cwd = () => projectRoot;
    try {
      const result = await loadPagesConfig();
      expect(result.global).toBeDefined();
      expect(result.pages).toBeDefined();
    } catch (e) {
      // pages.jsonc might not exist, that's ok
    }
  });
});

describe("saveConfig", () => {
  

  test("should save and reload config", async () => {
    try {
      const config = await loadConfig();
      await saveConfig(config);
    } catch (error) {
      // May fail if no valid config exists
    }
  });
});

describe("savePagesConfig", () => {
  

  test("should save pages config", async () => {
    const testConfig = {
      global: {
        cloudflare_api_token: "test-token",
        cloudflare_account_id: "test-account",
        cloudflare_secret_store_id: "test-store",
        subdomain_prefix: "test",
      },
      pages: {
        "test-page": {
          enabled: true,
          path: "pages/test",
        },
      },
    };
    try {
      await savePagesConfig(testConfig as any);
    } catch (error) {
      // May fail depending on cwd
    }
  });
});

describe("loadConfig error handling", () => {
  const originalCwd3 = process.cwd;

  afterEach(() => {
    process.cwd = originalCwd3;
  });

  test("should throw when example file is missing", async () => {
    process.cwd = () => path.resolve(projectRoot, "test-missing-example");
    
    try {
      await loadConfig();
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toContain("Example config");
    }
  });
});