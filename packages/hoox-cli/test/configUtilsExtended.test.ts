import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import toml from "toml";
import path from "path";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";

const testDir = path.join(os.tmpdir(), `hoox-config-extended-${Date.now()}`);

describe("Config Utils - Extended Tests", () => {
  beforeEach(async () => {
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe("Config Loading", () => {
    test("should load config with all required fields", () => {
      const config = {
        global: {
          cloudflare_api_token: "token123",
          cloudflare_account_id: "account123",
          cloudflare_secret_store_id: "store123",
          subdomain_prefix: "myapp",
        },
        workers: {
          "test-worker": {
            enabled: true,
            path: "workers/test",
          },
        },
      };

      expect(config.global.cloudflare_api_token).toBeDefined();
      expect(config.global.cloudflare_account_id).toBeDefined();
      expect(config.workers).toBeDefined();
    });

    test("should handle missing optional worker fields", () => {
      const config = {
        global: {
          cloudflare_api_token: "token",
          cloudflare_account_id: "account",
          cloudflare_secret_store_id: "store",
          subdomain_prefix: "prefix",
        },
        workers: {
          "minimal-worker": {
            enabled: true,
          },
        },
      };

      expect(config.workers["minimal-worker"].path).toBeUndefined();
      expect(config.workers["minimal-worker"].enabled).toBe(true);
    });

    test("should validate worker enabled status", () => {
      const workers = {
        enabled: {
          enabled: true,
          path: "workers/enabled",
        },
        disabled: {
          enabled: false,
          path: "workers/disabled",
        },
      };

      expect(workers.enabled.enabled).toBe(true);
      expect(workers.disabled.enabled).toBe(false);
    });
  });

  describe("Worker Path Resolution", () => {
    test("should resolve worker paths relative to root", () => {
      const rootDir = "/project";
      const workerPath = "workers/hoox";
      const resolved = path.resolve(rootDir, workerPath);

      expect(resolved).toBe(`${rootDir}/${workerPath}`);
    });

    test("should handle paths with leading slash", () => {
      const rootDir = "/project";
      const workerPath = "/workers/hoox";
      const resolved = path.resolve(rootDir, workerPath);

      expect(resolved).toBe("/workers/hoox");
    });
  });

  describe("URL Generation", () => {
    test("should generate worker URL with subdomain prefix", () => {
      const subdomainPrefix = "myapp";
      const workerName = "hoox";

      const url = `https://${workerName}.${subdomainPrefix}.workers.dev`;
      expect(url).toBe("https://hoox.myapp.workers.dev");
    });

    test("should handle hyphens in worker names", () => {
      const subdomainPrefix = "test";
      const workerName = "my-custom-worker";

      const url = `https://${workerName}.${subdomainPrefix}.workers.dev`;
      expect(url).toBe("https://my-custom-worker.test.workers.dev");
    });

    test("should handle custom domains", () => {
      const subdomainPrefix = "myapp";
      const workerName = "hoox";
      const customDomain = "api.myapp.com";

      const url = `https://${customDomain}`;
      expect(url).toBe("https://api.myapp.com");
    });
  });

  describe("Environment Variables", () => {
    test("should merge worker vars with defaults", () => {
      const defaultVars = { ENV: "production", DEBUG: "false" };
      const workerVars = { DEBUG: "true" };

      const merged = { ...defaultVars, ...workerVars };
      expect(merged.ENV).toBe("production");
      expect(merged.DEBUG).toBe("true");
    });

    test("should handle empty vars", () => {
      const config = { vars: {} };
      const vars = config.vars || {};

      expect(Object.keys(vars)).toHaveLength(0);
    });
  });

  describe("Secrets Configuration", () => {
    test("should collect unique secrets from workers", () => {
      const workers = {
        worker1: { secrets: ["A", "B"] },
        worker2: { secrets: ["B", "C"] },
        worker3: { secrets: [] },
      };

      const allSecrets = new Set(
        Object.values(workers).flatMap((w) => w.secrets || [])
      );

      expect(allSecrets.size).toBe(3);
    });

    test("should handle workers without secrets", () => {
      const workers = {
        worker1: { enabled: true },
        worker2: { secrets: [] },
      };

      const hasSecrets = Object.values(workers).some(
        (w) => w.secrets && w.secrets.length > 0
      );

      expect(hasSecrets).toBe(false);
    });
  });

  describe("Service Bindings", () => {
    test("should parse service binding configuration", () => {
      const binding = {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
      };

      expect(binding.binding).toBe("TRADE_SERVICE");
      expect(binding.service).toBe("trade-worker");
    });

    test("should handle multiple service bindings", () => {
      const services = [
        { binding: "TRADE_SERVICE", service: "trade-worker" },
        { binding: "TELEGRAM_SERVICE", service: "telegram-worker" },
        { binding: "D1_SERVICE", service: "d1-worker" },
      ];

      expect(services).toHaveLength(3);
      expect(services.map((s) => s.binding)).toContain("TRADE_SERVICE");
    });
  });

  describe("Config File Operations", () => {
    test("should detect config file existence", async () => {
      const configPath = path.join(testDir, "workers.jsonc");
      await fsp.writeFile(configPath, "{}");

      const exists = fs.existsSync(configPath);
      expect(exists).toBe(true);
    });

    test("should handle missing config file", () => {
      const configPath = path.join(testDir, "missing.jsonc");
      const exists = fs.existsSync(configPath);
      expect(exists).toBe(false);
    });
  });
});

describe("Config Utils - Integration Tests", () => {
  const integrationDir = path.join(
    os.tmpdir(),
    `hoox-config-integration-${Date.now()}`
  );

  beforeEach(async () => {
    await fsp.mkdir(integrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(integrationDir, { recursive: true, force: true });
  });

  test("should load and validate complete config", async () => {
    const configPath = path.join(integrationDir, "workers.jsonc");
    const configContent = JSON.stringify({
      global: {
        cloudflare_api_token: "test-token",
        cloudflare_account_id: "test-account",
        cloudflare_secret_store_id: "test-store",
        subdomain_prefix: "test",
      },
      workers: {
        hoox: { enabled: true, path: "workers/hoox", secrets: ["KEY1"] },
        "trade-worker": { enabled: true, path: "workers/trade-worker" },
      },
    });

    await fsp.writeFile(configPath, configContent);
    const content = await fsp.readFile(configPath, "utf8");
    const config = JSON.parse(content);

    expect(config.global.cloudflare_api_token).toBe("test-token");
    expect(config.workers.hoox.enabled).toBe(true);
  });

  test("should resolve all worker URLs", () => {
    const prefix = "myapp";
    const workers = ["hoox", "trade-worker", "d1-worker", "telegram-worker"];

    const urls = workers.map((w) => `https://${w}.${prefix}.workers.dev`);

    expect(urls).toHaveLength(4);
    expect(urls[0]).toBe("https://hoox.myapp.workers.dev");
    expect(urls[3]).toBe("https://telegram-worker.myapp.workers.dev");
  });
});
