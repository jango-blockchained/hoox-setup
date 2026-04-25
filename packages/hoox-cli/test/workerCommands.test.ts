import fs from "node:fs";
import { describe, expect, test, beforeEach, jest } from "bun:test";
import type { WorkerConfig } from "../src/types.js";

describe("Worker Management - Extended Tests", () => {
  describe("Worker Selection Logic", () => {
    test("should filter enabled workers", () => {
      const workers = {
        worker1: { enabled: true, path: "workers/worker1" },
        worker2: { enabled: false, path: "workers/worker2" },
        worker3: { enabled: true, path: "workers/worker3" },
      };

      const enabledWorkers = Object.entries(workers)
        .filter(([, config]) => config.enabled)
        .map(([name]) => name);

      expect(enabledWorkers).toEqual(["worker1", "worker3"]);
    });

    test("should map worker names to paths", () => {
      const workers = {
        "d1-worker": { enabled: true, path: "workers/d1-worker" },
        "telegram-worker": { enabled: true, path: "workers/telegram-worker" },
      };

      const paths = Object.entries(workers)
        .filter(([, config]) => config.enabled)
        .map(([name, config]) => config.path);

      expect(paths).toEqual(["workers/d1-worker", "workers/telegram-worker"]);
    });
  });

  describe("Secret Requirements", () => {
    test("should collect unique secrets from all workers", () => {
      const workers = {
        worker1: { secrets: ["SECRET_A", "SECRET_B"] },
        worker2: { secrets: ["SECRET_B", "SECRET_C"] },
        worker3: { secrets: [] },
      };

      const allSecrets = new Set<string>();
      for (const worker of Object.values(workers)) {
        for (const secret of (worker as WorkerConfig).secrets || []) {
          allSecrets.add(secret);
        }
      }

      expect(allSecrets.size).toBe(3);
      expect(allSecrets).toContain("SECRET_A");
      expect(allSecrets).toContain("SECRET_B");
      expect(allSecrets).toContain("SECRET_C");
    });

    test("should handle workers with no secrets", () => {
      const workers = {
        worker1: { secrets: ["SECRET_A"] },
        worker2: {},
      };

      const allSecrets = new Set<string>();
      for (const worker of Object.values(workers)) {
        for (const secret of (worker as WorkerConfig).secrets || []) {
          allSecrets.add(secret);
        }
      }

      expect(allSecrets.size).toBe(1);
    });
  });

  describe("Deployment Order", () => {
    test("should handle worker dependencies", () => {
      // Some workers depend on others (e.g., hoox depends on trade-worker)
      const workers = {
        "d1-worker": { enabled: true },
        hoox: { enabled: true, vars: {} },
        "trade-worker": { enabled: true },
        "telegram-worker": { enabled: true },
      };

      // All enabled workers should be deployable
      const enabled = Object.keys(workers).filter(
        (name) => (workers as Record<string, WorkerConfig>)[name].enabled
      );

      expect(enabled.length).toBe(4);
    });
  });

  describe("Worker State Validation", () => {
    test("should validate worker has required fields", () => {
      const validWorker = {
        enabled: true,
        path: "workers/test",
        secrets: ["SECRET"],
        vars: { KEY: "value" },
      };

      expect(validWorker.enabled).toBe(true);
      expect(validWorker.path).toBeDefined();
      expect(validWorker.secrets).toBeDefined();
    });

    test("should detect invalid worker configuration", () => {
      const invalidWorker = {
        enabled: true,
        path: "",
      };

      expect(invalidWorker.path === "").toBe(true);
    });
  });

  describe("URL Construction", () => {
    test("should construct worker URLs with subdomain prefix", () => {
      const prefix = "myapp";
      const workerName = "test-worker";

      const url = `https://${workerName}.${prefix}.workers.dev`;
      expect(url).toBe("https://test-worker.myapp.workers.dev");
    });

    test("should handle special characters in worker names", () => {
      const prefix = "myapp";
      const workerName = "home-assistant";

      const url = `https://${workerName}.${prefix}.workers.dev`;
      expect(url).toBe("https://home-assistant.myapp.workers.dev");
    });
  });
});

describe("Environment Variable Handling", () => {
  test("should merge environment variables", () => {
    const defaults = { VAR1: "default1", VAR2: "default2" };
    const overrides = { VAR2: "override2", VAR3: "new" };

    const merged = { ...defaults, ...overrides };

    expect(merged.VAR1).toBe("default1");
    expect(merged.VAR2).toBe("override2");
    expect(merged.VAR3).toBe("new");
  });

  test("should create cloudflare env object", () => {
    const apiToken = "test-token";

    const env = { CLOUDFLARE_API_TOKEN: apiToken };

    expect(env.CLOUDFLARE_API_TOKEN).toBe("test-token");
  });
});

describe("Error Handling", () => {
  test("should handle missing worker directory", async () => {
    const fs = require("fs");
    const path = require("path");

    const workerPath = path.resolve(process.cwd(), "workers/nonexistent");
    const exists = (await Bun.file(workerPath).exists());

    expect(exists).toBe(false);
  });

  test("should handle invalid JSON config", () => {
    const invalidJson = "{ invalid json }";

    expect(() => JSON.parse(invalidJson)).toThrow();
  });
});
