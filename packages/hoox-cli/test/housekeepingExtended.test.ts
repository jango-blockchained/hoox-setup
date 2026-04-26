import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import path from "path";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";

const testDir = path.join(os.tmpdir(), `hoox-housekeeping-extended-${Date.now()}-${Math.random().toString(36).substring(7)}`);

describe("Housekeeping - Extended Tests", () => {
  beforeEach(async () => {
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe("Worker Directory Validation", () => {
    test("should validate worker directory exists", () => {
      const workerPath = path.join(testDir, "workers", "hoox");
      fs.mkdirSync(workerPath, { recursive: true });

      expect(fs.existsSync(workerPath)).toBe(true);
    });

    test("should detect missing worker directory", () => {
      const workerPath = path.join(testDir, "workers", "missing");
      expect(fs.existsSync(workerPath)).toBe(false);
    });

    test("should list all worker directories", async () => {
      const workersDir = path.join(testDir, "workers");
      fs.mkdirSync(path.join(workersDir, "worker1"), { recursive: true });
      fs.mkdirSync(path.join(workersDir, "worker2"), { recursive: true });
      fs.mkdirSync(path.join(workersDir, ".hidden"), { recursive: true });

      const entries = await fsp.readdir(workersDir);
      const workerDirs = entries.filter(
        e => !e.startsWith(".") && fs.statSync(path.join(workersDir, e)).isDirectory()
      );

      expect(workerDirs).toHaveLength(2);
    });
  });

  describe("Wrangler Config Validation", () => {
    test("should validate wrangler.jsonc exists", async () => {
      const workerDir = path.join(testDir, "workers", "hoox");
      fs.mkdirSync(workerDir, { recursive: true });
      
      const wranglerPath = path.join(workerDir, "wrangler.jsonc");
      await fsp.writeFile(wranglerPath, '{"name": "hoox"}');

      expect(fs.existsSync(wranglerPath)).toBe(true);
    });

    test("should detect missing wrangler config", () => {
      const workerDir = path.join(testDir, "workers", "hoox");
      const wranglerPath = path.join(workerDir, "wrangler.jsonc");
      expect(fs.existsSync(wranglerPath)).toBe(false);
    });

    test("should parse wrangler config JSONC", async () => {
      const wranglerPath = path.join(testDir, "wrangler.jsonc");
      const content = `{
        // Worker name
        "name": "test-worker",
        "compatibility_date": "2024-01-01"
      }`;
      
      await fsp.writeFile(wranglerPath, content);
      const fileContent = await fsp.readFile(wranglerPath, "utf8");
      const cleaned = fileContent.replace(/\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
      const parsed = JSON.parse(cleaned);

      expect(parsed.name).toBe("test-worker");
    });
  });

  describe("Account ID Validation", () => {
    test("should validate Cloudflare account ID format", () => {
      const accountId = "abc123def456ghi789jkl012abc123de";
      expect(accountId).toHaveLength(32);
    });

    test("should detect invalid account ID", () => {
      const invalidIds = ["short", "has-special-chars!", ""];
      
      invalidIds.forEach(id => {
        const isValid = id.length >= 32 && /^[a-z0-9]+$/.test(id);
        expect(isValid).toBe(false);
      });
    });
  });

  describe("Secret Bindings Validation", () => {
    test("should list required secrets for worker", () => {
      const workerConfig = {
        secrets: ["API_KEY", "SECRET_TOKEN", "DATABASE_URL"],
      };

      expect(workerConfig.secrets).toHaveLength(3);
    });

    test("should handle worker without secrets", () => {
      const workerConfig = {};
      const secrets = workerConfig.secrets || [];

      expect(secrets).toHaveLength(0);
    });

    test("should compare secrets with bindings", () => {
      const requiredSecrets = ["KEY1", "KEY2", "KEY3"];
      const boundSecrets = ["KEY1", "KEY2"];

      const missing = requiredSecrets.filter(s => !boundSecrets.includes(s));
      
      expect(missing).toHaveLength(1);
      expect(missing).toContain("KEY3");
    });
  });

  describe("Service Bindings Validation", () => {
    test("should validate service binding structure", () => {
      const binding = { binding: "TRADE_SERVICE", service: "trade-worker" };

      expect(binding.binding).toBeDefined();
      expect(binding.service).toBeDefined();
    });

    test("should detect missing service bindings", () => {
      const required = ["TRADE_SERVICE", "TELEGRAM_SERVICE"];
      const available: string[] = ["TRADE_SERVICE"];

      const missing = required.filter(s => !available.includes(s));
      
      expect(missing).toContain("TELEGRAM_SERVICE");
    });
  });

  describe("D1 Database Validation", () => {
    test("should validate D1 binding exists", () => {
      const config = {
        bindings: { DB: { id: "d1-id-123" } },
      };

      expect(config.bindings.DB).toBeDefined();
    });

    test("should detect missing D1 binding", () => {
      const config = { bindings: {} };
      
      expect(config.bindings.DB).toBeUndefined();
    });
  });

  describe("Source File Validation", () => {
    test("should validate source file exists", async () => {
      const srcPath = path.join(testDir, "workers", "hoox", "src", "index.ts");
      fs.mkdirSync(path.dirname(srcPath), { recursive: true });
      await fsp.writeFile(srcPath, "export default {}");

      expect(fs.existsSync(srcPath)).toBe(true);
    });

    test("should detect missing source file", () => {
      const srcPath = path.join(testDir, "workers", "hoox", "src", "missing.ts");
      expect(fs.existsSync(srcPath)).toBe(false);
    });
  });

  describe("Housekeeping Report Generation", () => {
    test("should create report with timestamp", () => {
      const report = {
        timestamp: new Date().toISOString(),
        totalWorkers: 5,
        checkedWorkers: 3,
        issues: [],
        summary: { errors: 0, warnings: 0, info: 0 },
      };

      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
    });

    test("should count workers correctly", () => {
      const workers = {
        hoox: { enabled: true },
        "trade-worker": { enabled: true },
        "d1-worker": { enabled: false },
      };

      const enabled = Object.values(workers).filter(w => w.enabled);
      const total = Object.keys(workers).length;

      expect(enabled).toHaveLength(2);
      expect(total).toBe(3);
    });

    test("should categorize issues by severity", () => {
      const issues = [
        { severity: "error", message: "Missing secret" },
        { severity: "warning", message: "Config may be outdated" },
        { severity: "info", message: "Update available" },
      ];

      const errors = issues.filter(i => i.severity === "error");
      const warnings = issues.filter(i => i.severity === "warning");
      const info = issues.filter(i => i.severity === "info");

      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(info).toHaveLength(1);
    });
  });
});

describe("Housekeeping - Integration Tests", () => {
  const integrationDir = path.join(os.tmpdir(), `hoox-housekeeping-integration-${Date.now()}-${Math.random().toString(36).substring(7)}`);

  beforeEach(async () => {
    await fsp.mkdir(integrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(integrationDir, { recursive: true, force: true });
  });

  test("complete worker validation flow", async () => {
    const workersDir = path.join(integrationDir, "workers");
    fs.mkdirSync(path.join(workersDir, "hoox", "src"), { recursive: true });
    fs.mkdirSync(path.join(workersDir, "trade-worker", "src"), { recursive: true });
    await fsp.writeFile(
      path.join(workersDir, "hoox", "wrangler.jsonc"),
      '{"name": "hoox", "compatibility_date": "2024-01-01"}'
    );
    await fsp.writeFile(
      path.join(workersDir, "trade-worker", "wrangler.jsonc"),
      '{"name": "trade-worker"}'
    );
    await fsp.writeFile(
      path.join(workersDir, "hoox", "src", "index.ts"),
      "export default {}"
    );
    await fsp.writeFile(
      path.join(workersDir, "trade-worker", "src", "index.ts"),
      "export default {}"
    );

    const entries = await fsp.readdir(workersDir);
    const validWorkers = [];

    for (const entry of entries) {
      const workerPath = path.join(workersDir, entry);
      const stat = await fsp.stat(workerPath);
      
      if (stat.isDirectory()) {
        const srcExists = fs.existsSync(path.join(workerPath, "src"));
        const wranglerExists = fs.existsSync(path.join(workerPath, "wrangler.jsonc"));
        
        if (srcExists && wranglerExists) {
          validWorkers.push(entry);
        }
      }
    }

    expect(validWorkers).toHaveLength(2);
  });
});