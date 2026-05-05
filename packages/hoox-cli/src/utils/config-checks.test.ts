import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  checkWorkersJsonc,
  checkWranglerConfigs,
  checkEnvLocal,
  checkSubmodules,
} from "./config-checks.js";

describe("config checks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hoox-config-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("checkWorkersJsonc", () => {
    it("returns error when workers.jsonc not found", async () => {
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("returns success for valid workers.jsonc", async () => {
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

    it("returns error when account_id missing", async () => {
      writeFileSync(
        join(tmpDir, "workers.jsonc"),
        JSON.stringify({
          global: { subdomain_prefix: "test" },
          workers: { hoox: { enabled: true, path: "workers/hoox" } },
        })
      );
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("cloudflare_account_id");
    });

    it("returns error when subdomain_prefix missing", async () => {
      writeFileSync(
        join(tmpDir, "workers.jsonc"),
        JSON.stringify({
          global: { cloudflare_account_id: "test123" },
          workers: { hoox: { enabled: true, path: "workers/hoox" } },
        })
      );
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("subdomain_prefix");
    });

    it("returns error when no workers defined", async () => {
      writeFileSync(
        join(tmpDir, "workers.jsonc"),
        JSON.stringify({
          global: {
            cloudflare_account_id: "test123",
            subdomain_prefix: "test",
          },
          workers: {},
        })
      );
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("No workers defined");
    });

    it("returns error for invalid JSON", async () => {
      writeFileSync(join(tmpDir, "workers.jsonc"), "{ invalid json }");
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Invalid JSON");
    });

    it("strips comments from JSONC before parsing", async () => {
      writeFileSync(
        join(tmpDir, "workers.jsonc"),
        `{
  // This is a comment
  "global": { "cloudflare_account_id": "test123", "subdomain_prefix": "test" },
  "workers": { "hoox": { "enabled": true, "path": "workers/hoox" } }
}`
      );
      const result = await checkWorkersJsonc(tmpDir);
      expect(result.success).toBe(true);
    });
  });

  describe("checkWranglerConfigs", () => {
    it("returns error when wrangler config missing for enabled worker", async () => {
      const workers = {
        hoox: { enabled: true, path: "workers/hoox" },
      };
      const result = await checkWranglerConfigs(tmpDir, workers);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("missing wrangler");
    });

    it("skips disabled workers", async () => {
      const workers = {
        hoox: { enabled: false, path: "workers/hoox" },
      };
      const result = await checkWranglerConfigs(tmpDir, workers);
      expect(result.success).toBe(true);
    });

    it("returns warning for placeholder values", async () => {
      mkdirSync(join(tmpDir, "workers", "hoox"), { recursive: true });
      writeFileSync(
        join(tmpDir, "workers", "hoox", "wrangler.jsonc"),
        JSON.stringify({ name: "hoox", account_id: "<YOUR_ACCOUNT_ID>" })
      );
      const workers = {
        hoox: { enabled: true, path: "workers/hoox" },
      };
      const result = await checkWranglerConfigs(tmpDir, workers);
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("returns success for valid wrangler config", async () => {
      mkdirSync(join(tmpDir, "workers", "hoox"), { recursive: true });
      writeFileSync(
        join(tmpDir, "workers", "hoox", "wrangler.jsonc"),
        JSON.stringify({ name: "hoox", account_id: "real_id" })
      );
      const workers = {
        hoox: { enabled: true, path: "workers/hoox" },
      };
      const result = await checkWranglerConfigs(tmpDir, workers);
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBe(0);
    });
  });

  describe("checkEnvLocal", () => {
    it("returns error when .env.local not found", async () => {
      const result = await checkEnvLocal(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain(".env.local not found");
    });

    it("returns error for placeholder values", async () => {
      writeFileSync(
        join(tmpDir, ".env.local"),
        'CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"\nCLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"'
      );
      const result = await checkEnvLocal(tmpDir);
      expect(result.success).toBe(false);
    });

    it("returns success for valid .env.local", async () => {
      writeFileSync(
        join(tmpDir, ".env.local"),
        'CLOUDFLARE_API_TOKEN="cfut_real_token"\nCLOUDFLARE_ACCOUNT_ID="abc123def456"'
      );
      const result = await checkEnvLocal(tmpDir);
      expect(result.success).toBe(true);
    });

    it("returns error when required key is missing", async () => {
      writeFileSync(
        join(tmpDir, ".env.local"),
        'CLOUDFLARE_API_TOKEN="real_token"'
      );
      const result = await checkEnvLocal(tmpDir);
      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.includes("CLOUDFLARE_ACCOUNT_ID"))
      ).toBe(true);
    });
  });

  describe("checkSubmodules", () => {
    it("returns errors for missing worker directories", async () => {
      const result = await checkSubmodules(tmpDir);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("returns success when all workers exist", async () => {
      const workers = [
        "hoox",
        "trade-worker",
        "agent-worker",
        "d1-worker",
        "telegram-worker",
        "web3-wallet-worker",
        "email-worker",
        "analytics-worker",
      ];
      mkdirSync(join(tmpDir, "workers"), { recursive: true });
      for (const w of workers) {
        mkdirSync(join(tmpDir, "workers", w), { recursive: true });
        writeFileSync(join(tmpDir, "workers", w, "package.json"), "{}");
      }
      const result = await checkSubmodules(tmpDir);
      expect(result.success).toBe(true);
    });
  });
});
