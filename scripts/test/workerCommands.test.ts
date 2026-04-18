import { describe, expect, test, beforeEach, jest } from "bun:test";

// Mock implementations for testing worker command logic

interface WorkerConfig {
  enabled: boolean;
  path: string;
  vars?: Record<string, string>;
  secrets?: string[];
  deployed_url?: string;
}

interface Config {
  global: {
    cloudflare_api_token: string;
    cloudflare_account_id: string;
    cloudflare_secret_store_id: string;
    subdomain_prefix: string;
    d1_database_id?: string;
  };
  workers: Record<string, WorkerConfig>;
}

// Test config validation
function validateConfig(config: Config): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate global section
  if (!config.global.cloudflare_api_token) {
    errors.push("Missing cloudflare_api_token");
  }
  if (!config.global.cloudflare_account_id) {
    errors.push("Missing cloudflare_account_id");
  }
  if (!config.global.cloudflare_secret_store_id) {
    errors.push("Missing cloudflare_secret_store_id");
  }
  if (!config.global.subdomain_prefix) {
    errors.push("Missing subdomain_prefix");
  }

  // Validate workers
  for (const [name, worker] of Object.entries(config.workers)) {
    if (worker.enabled && !worker.path) {
      errors.push(`Worker ${name} is enabled but missing path`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function generateWorkerUrls(config: Config): Record<string, string> {
  const urls: Record<string, string> = {};
  const prefix = config.global.subdomain_prefix;

  for (const [name, worker] of Object.entries(config.workers)) {
    if (worker.enabled) {
      urls[name] = `https://${name}.${prefix}.workers.dev`;
    }
  }

  return urls;
}

function checkWorkerDirectories(config: Config): {
  exists: string[];
  missing: string[];
} {
  const fs = require("fs");
  const path = require("path");

  const exists: string[] = [];
  const missing: string[] = [];
  const rootDir = process.cwd();

  for (const [name, worker] of Object.entries(config.workers)) {
    if (worker.enabled) {
      const workerPath = path.resolve(rootDir, worker.path);
      if (fs.existsSync(workerPath)) {
        exists.push(name);
      } else {
        missing.push(name);
      }
    }
  }

  return { exists, missing };
}

describe("Worker Management Logic", () => {
  describe("Config Validation", () => {
    test("should validate complete config", () => {
      const config: Config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "test-store",
          subdomain_prefix: "test",
        },
        workers: {
          "test-worker": {
            enabled: true,
            path: "workers/test-worker",
          },
        },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should detect missing global fields", () => {
      const config: Config = {
        global: {
          cloudflare_api_token: "",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "test-store",
          subdomain_prefix: "test",
        },
        workers: {},
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing cloudflare_api_token");
    });

    test("should detect enabled worker without path", () => {
      const config: Config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "test-store",
          subdomain_prefix: "test",
        },
        workers: {
          "test-worker": {
            enabled: true,
            path: "",
          },
        },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Worker test-worker is enabled but missing path"
      );
    });
  });

  describe("URL Generation", () => {
    test("should generate correct worker URLs", () => {
      const config: Config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "test-store",
          subdomain_prefix: "myapp",
        },
        workers: {
          worker1: { enabled: true, path: "workers/worker1" },
          worker2: { enabled: false, path: "workers/worker2" },
          worker3: { enabled: true, path: "workers/worker3" },
        },
      };

      const urls = generateWorkerUrls(config);

      expect(urls["worker1"]).toBe("https://worker1.myapp.workers.dev");
      expect(urls["worker3"]).toBe("https://worker3.myapp.workers.dev");
      expect(urls["worker2"]).toBeUndefined();
    });

    test("should handle special characters in prefix", () => {
      const config: Config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "test-store",
          subdomain_prefix: "my-app-v1",
        },
        workers: {
          test: { enabled: true, path: "workers/test" },
        },
      };

      const urls = generateWorkerUrls(config);
      expect(urls["test"]).toBe("https://test.my-app-v1.workers.dev");
    });
  });

  describe("Worker Directory Check", () => {
    test("should identify existing and missing directories", () => {
      const config: Config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "test-store",
          subdomain_prefix: "test",
        },
        workers: {
          // These paths should exist for the test to pass
          "d1-worker": { enabled: true, path: "workers/d1-worker" },
          "telegram-worker": { enabled: true, path: "workers/telegram-worker" },
          nonexistent: { enabled: true, path: "workers/nonexistent" },
        },
      };

      const result = checkWorkerDirectories(config);

      // d1-worker and telegram-worker should exist
      expect(result.exists).toContain("d1-worker");
      expect(result.exists).toContain("telegram-worker");
      // nonexistent should be missing
      expect(result.missing).toContain("nonexistent");
    });
  });
});
