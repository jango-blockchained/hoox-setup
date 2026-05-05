/**
 * Integration tests for CLI setup commands.
 *
 * These tests verify that all new commands can be loaded,
 * have correct metadata, and can execute basic operations
 * with mocked adapters.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ── Command imports (matching actual export patterns) ─────────────────

import { CheckSetupCommand } from "../../src/commands/check-setup/index.js";
import housekeepingCommand from "../../src/commands/housekeeping/index.js";
import r2Command from "../../src/commands/r2/index.js";
import wafCommand from "../../src/commands/waf/index.js";
import { RepairCommand } from "../../src/commands/repair/index.js";
import { WorkersSetupCommand } from "../../src/commands/workers/setup.js";
import { ConfigInitCommand } from "../../src/commands/config/init.js";
import { WorkersUpdateInternalUrlsCommand } from "../../src/commands/workers/update-urls.js";

// ── Utility imports ───────────────────────────────────────────────────

import { createValidationResult } from "../../src/utils/validation.js";
import {
  checkWorkersJsonc,
  checkEnvLocal,
  checkSubmodules,
} from "../../src/utils/config-checks.js";
import {
  checkD1Database,
  checkR2Buckets,
  checkQueues,
} from "../../src/utils/infrastructure-checks.js";
import { checkLocalSecrets } from "../../src/utils/secret-checks.js";
import {
  checkRequiredTables,
  checkTrackingSchema,
} from "../../src/utils/database-checks.js";

// ── Mock helpers ──────────────────────────────────────────────────────

function createMockAdapter(overrides: Record<string, unknown> = {}) {
  return {
    listD1Databases: async () => [],
    listKVNamespaces: async () => [],
    listR2Buckets: async () => [],
    listQueues: async () => [],
    listSecrets: async () => [],
    setSecret: async () => {},
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("CLI Setup Commands - Integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hoox-integration-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Command Registration ───────────────────────────────────────────

  describe("command registration", () => {
    it("check-setup command has correct metadata", () => {
      const cmd = new CheckSetupCommand();
      expect(cmd.name).toBe("check-setup");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });

    it("housekeeping command has correct metadata", () => {
      const cmd = new housekeepingCommand();
      expect(cmd.name).toBe("housekeeping");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });

    it("r2 command has correct metadata", () => {
      const cmd = new r2Command();
      expect(cmd.name).toBe("r2");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });

    it("waf command has correct metadata", () => {
      const cmd = new wafCommand();
      expect(cmd.name).toBe("waf");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });

    it("repair command has correct metadata", () => {
      const cmd = new RepairCommand();
      expect(cmd.name).toBe("repair");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });

    it("workers:setup command has correct metadata", () => {
      const cmd = new WorkersSetupCommand();
      expect(cmd.name).toBe("workers:setup");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });

    it("config:init command has correct metadata", () => {
      const cmd = new ConfigInitCommand();
      expect(cmd.name).toBe("config:init");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });

    it("workers:update-internal-urls command has correct metadata", () => {
      const cmd = new WorkersUpdateInternalUrlsCommand();
      expect(cmd.name).toBe("workers:update-internal-urls");
      expect(cmd.description).toBeDefined();
      expect(cmd.execute).toBeDefined();
    });
  });

  // ── Validation Utilities ───────────────────────────────────────────

  describe("validation utilities", () => {
    it("createValidationResult creates proper result", () => {
      const result = createValidationResult("test");
      expect(result.name).toBe("test");
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it("addError marks result as failed", () => {
      const result = createValidationResult("test");
      result.addError("something broke");
      expect(result.success).toBe(false);
      expect(result.errors).toContain("something broke");
    });

    it("addWarning keeps result successful", () => {
      const result = createValidationResult("test");
      result.addWarning("minor issue");
      expect(result.success).toBe(true);
      expect(result.warnings).toContain("minor issue");
    });
  });

  // ── Config Checks ──────────────────────────────────────────────────

  describe("config checks integration", () => {
    it("detects missing workers.jsonc", async () => {
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("validates workers.jsonc with required fields", async () => {
      writeFileSync(
        join(tmpDir, "workers.jsonc"),
        JSON.stringify({
          global: {
            cloudflare_account_id: "test123",
            subdomain_prefix: "test",
          },
          workers: { hoox: { enabled: true, path: "workers/hoox" } },
        })
      );
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(true);
    });

    it("detects missing .env.local", async () => {
      const result = await checkEnvLocal(tmpDir);
      expect(result.success).toBe(false);
    });

    it("detects missing submodules", async () => {
      const result = await checkSubmodules(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ── Infrastructure Checks ─────────────────────────────────────────

  describe("infrastructure checks integration", () => {
    it("detects missing D1 database", async () => {
      const adapter = createMockAdapter({ listD1Databases: async () => [] });
      const result = await checkD1Database(adapter as any, "trade-data-db");
      expect(result.success).toBe(false);
    });

    it("detects missing R2 buckets", async () => {
      const adapter = createMockAdapter({ listR2Buckets: async () => [] });
      const result = await checkR2Buckets(adapter as any, ["trade-reports"]);
      expect(result.success).toBe(false);
    });

    it("detects missing queues", async () => {
      const adapter = createMockAdapter({ listQueues: async () => [] });
      const result = await checkQueues(adapter as any, ["trade-execution"]);
      expect(result.success).toBe(false);
    });
  });

  // ── Secret Checks ──────────────────────────────────────────────────

  describe("secret checks integration", () => {
    it("detects missing local secrets", async () => {
      const result = await checkLocalSecrets("/nonexistent");
      expect(result.success).toBe(false);
    });
  });

  // ── Database Checks ────────────────────────────────────────────────

  describe("database checks integration", () => {
    it("detects missing tables", async () => {
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: [] }),
      });
      const result = await checkRequiredTables(adapter as any, "trade-data-db");
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("detects missing tracking schema", async () => {
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: [] }),
      });
      const result = await checkTrackingSchema(adapter as any, "trade-data-db");
      expect(result.success).toBe(false);
    });
  });
});
