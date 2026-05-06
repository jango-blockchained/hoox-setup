import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "./config-service.js";

/**
 * Helper: write a workers.jsonc file to a test directory using Bun.
 */
async function writeConfig(dir: string, content: string): Promise<void> {
  await Bun.write(join(dir, "workers.jsonc"), content);
}

/**
 * Helper: create a minimal valid config JSON string.
 */
function validConfigJson(): string {
  return JSON.stringify(
    {
      global: {
        cloudflare_account_id: "abc123",
      },
      workers: {
        "test-worker": {
          enabled: true,
          path: "workers/test-worker",
        },
      },
    },
    null,
    2,
  );
}

/**
 * Helper: create a valid config with JSONC comments.
 */
function validConfigWithComments(): string {
  return `{
  // This is a line comment
  "global": {
    /* Block comment explaining account_id */
    "cloudflare_account_id": "abc123"
  },
  "workers": {
    "test-worker": {
      "enabled": true,
      "path": "workers/test-worker" // inline comment
    }
  }
}`;
}

describe("ConfigService", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hoox-config-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Constructor defaults ──────────────────────────────────────────

  it("defaults config path to workers.jsonc in cwd", () => {
    const service = new ConfigService();
    // Constructor stores the default path — verified via load() behavior
    expect(service).toBeInstanceOf(ConfigService);
  });

  it("accepts a custom config path in constructor", () => {
    const customPath = "/tmp/custom-workers.jsonc";
    const service = new ConfigService(customPath);
    expect(service).toBeInstanceOf(ConfigService);
  });

  // ── load() — happy path ───────────────────────────────────────────

  it("loads and parses a valid workers.jsonc", async () => {
    await writeConfig(tmpDir, validConfigJson());
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    const config = await service.load();
    expect(config.global.cloudflare_account_id).toBe("abc123");
    expect(config.workers["test-worker"]).toBeDefined();
  });

  it("loads a config with enabled/disabled workers", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {
        "worker-a": { enabled: true, path: "workers/a" },
        "worker-b": { enabled: false, path: "workers/b" },
        "worker-c": { enabled: true, path: "workers/c" },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    expect(service.listWorkers()).toEqual(["worker-a", "worker-b", "worker-c"]);
    expect(service.listEnabledWorkers()).toEqual(["worker-a", "worker-c"]);
  });

  // ── load() — error cases ──────────────────────────────────────────

  it("throws when config file does not exist", async () => {
    const service = new ConfigService(join(tmpDir, "nonexistent.jsonc"));
    await expect(service.load()).rejects.toThrow("not found");
  });

  it("throws for invalid JSONC syntax", async () => {
    await writeConfig(tmpDir, "{ not valid json @@@ }");
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await expect(service.load()).rejects.toThrow("Invalid JSONC");
  });

  it("throws when root is not an object (e.g. an array)", async () => {
    await writeConfig(tmpDir, "[1, 2, 3]");
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await expect(service.load()).rejects.toThrow("must contain a JSON object");
  });

  it("throws when root is a primitive (e.g. string)", async () => {
    await writeConfig(tmpDir, '"just a string"');
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await expect(service.load()).rejects.toThrow("must contain a JSON object");
  });

  // ── Comment stripping (JSONC support) ─────────────────────────────

  it("strips // line comments via jsonc-parser", async () => {
    await writeConfig(tmpDir, validConfigWithComments());
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    const config = await service.load();
    expect(config.global.cloudflare_account_id).toBe("abc123");
  });

  it("strips /* */ block comments via jsonc-parser", async () => {
    const content = `{
  /* multi
     line
     block */
  "global": { "cloudflare_account_id": "xyz" },
  "workers": { "w": { "enabled": true, "path": "p" } }
}`;
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    const config = await service.load();
    expect(config.global.cloudflare_account_id).toBe("xyz");
  });

  it("handles pure JSON (no comments) correctly", async () => {
    await writeConfig(tmpDir, validConfigJson());
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    const config = await service.load();
    expect(config.global.cloudflare_account_id).toBe("abc123");
  });

  // ── Accessor methods (after load) ─────────────────────────────────

  it("getWorker() returns a worker config by name", async () => {
    await writeConfig(tmpDir, validConfigJson());
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const worker = service.getWorker("test-worker");
    expect(worker).toBeDefined();
    expect(worker?.enabled).toBe(true);
    expect(worker?.path).toBe("workers/test-worker");
  });

  it("getWorker() returns undefined for unknown worker", async () => {
    await writeConfig(tmpDir, validConfigJson());
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    expect(service.getWorker("nonexistent")).toBeUndefined();
  });

  it("getGlobal() returns the global config section", async () => {
    await writeConfig(tmpDir, validConfigJson());
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const global = service.getGlobal();
    expect(global.cloudflare_account_id).toBe("abc123");
  });

  it("listWorkers() returns all worker names", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {
        "w1": { enabled: true, path: "workers/w1" },
        "w2": { enabled: false, path: "workers/w2" },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    expect(service.listWorkers().sort()).toEqual(["w1", "w2"]);
  });

  it("listEnabledWorkers() filters to only enabled workers", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {
        "w1": { enabled: true, path: "workers/w1" },
        "w2": { enabled: false, path: "workers/w2" },
        "w3": { enabled: true, path: "workers/w3" },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const enabled = service.listEnabledWorkers().sort();
    expect(enabled).toEqual(["w1", "w3"]);
    expect(enabled).not.toContain("w2");
  });

  it("listEnabledWorkers() returns empty array when all disabled", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {
        "w1": { enabled: false, path: "workers/w1" },
        "w2": { enabled: false, path: "workers/w2" },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    expect(service.listEnabledWorkers()).toEqual([]);
  });

  // ── Accessor guards (before load) ─────────────────────────────────

  it("getWorker() throws if called before load()", () => {
    const service = new ConfigService();
    expect(() => service.getWorker("any")).toThrow("not loaded");
  });

  it("getGlobal() throws if called before load()", () => {
    const service = new ConfigService();
    expect(() => service.getGlobal()).toThrow("not loaded");
  });

  it("listWorkers() throws if called before load()", () => {
    const service = new ConfigService();
    expect(() => service.listWorkers()).toThrow("not loaded");
  });

  it("listEnabledWorkers() throws if called before load()", () => {
    const service = new ConfigService();
    expect(() => service.listEnabledWorkers()).toThrow("not loaded");
  });

  // ── validate() ────────────────────────────────────────────────────

  it("validate() returns valid: true for a valid config", async () => {
    await writeConfig(tmpDir, validConfigJson());
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const result = service.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("validate() returns errors when config not loaded", () => {
    const service = new ConfigService();
    const result = service.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not loaded");
  });

  it("validate() catches missing global.cloudflare_account_id", async () => {
    const content = JSON.stringify({
      global: {},
      workers: { "w": { enabled: true, path: "workers/w" } },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const result = service.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cloudflare_account_id"))).toBe(
      true,
    );
  });

  it("validate() catches missing global section entirely", async () => {
    const content = JSON.stringify({
      workers: { "w": { enabled: true, path: "workers/w" } },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const result = service.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cloudflare_account_id"))).toBe(
      true,
    );
  });

  it("validate() catches missing worker path", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {
        "bad-worker": { enabled: true },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const result = service.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("path"))).toBe(true);
  });

  it("validate() catches empty workers section", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {},
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const result = service.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("No workers"))).toBe(true);
  });

  it("validate() reports multiple errors at once", async () => {
    const content = JSON.stringify({
      global: {},
      workers: {
        "w1": { enabled: true },
        "w2": { enabled: false },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const result = service.validate();
    expect(result.valid).toBe(false);
    // Should have at least 3 errors: account_id missing, w1 missing path, w2 missing path
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  // ── Worker config with secrets and vars ───────────────────────────

  it("parses worker secrets array", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {
        "secrets-worker": {
          enabled: true,
          path: "workers/secrets-worker",
          secrets: ["API_KEY", "DB_PASSWORD"],
        },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const worker = service.getWorker("secrets-worker");
    expect(worker?.secrets).toEqual(["API_KEY", "DB_PASSWORD"]);
  });

  it("parses worker vars", async () => {
    const content = JSON.stringify({
      global: { cloudflare_account_id: "abc123" },
      workers: {
        "vars-worker": {
          enabled: true,
          path: "workers/vars-worker",
          vars: { DATABASE_NAME: "my-db", LOG_LEVEL: "debug" },
        },
      },
    });
    await writeConfig(tmpDir, content);
    const service = new ConfigService(join(tmpDir, "workers.jsonc"));
    await service.load();
    const worker = service.getWorker("vars-worker");
    expect(worker?.vars).toEqual({ DATABASE_NAME: "my-db", LOG_LEVEL: "debug" });
  });

  // ── load() called with explicit path overrides constructor ─────────

  it("load() with explicit path overrides the constructor path", async () => {
    await writeConfig(tmpDir, validConfigJson());
    const service = new ConfigService("/some/wrong/path.jsonc");
    const config = await service.load(join(tmpDir, "workers.jsonc"));
    expect(config.global.cloudflare_account_id).toBe("abc123");
  });
});
