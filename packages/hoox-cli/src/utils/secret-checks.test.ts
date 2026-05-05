import { describe, it, expect } from "bun:test";
import { checkWorkerSecrets, checkLocalSecrets, checkDevVars } from "./secret-checks.js";
import { CloudflareAdapter } from "../adapters/cloudflare.js";

function createMockAdapter(overrides: Record<string, unknown> = {}): CloudflareAdapter {
  return {
    listSecrets: overrides.listSecrets || (async () => []),
    ...overrides,
  } as unknown as CloudflareAdapter;
}

describe("secret checks", () => {
  describe("checkWorkerSecrets", () => {
    it("reports missing secrets", async () => {
      const adapter = createMockAdapter({
        listSecrets: async () => [{ name: "WEBHOOK_API_KEY_BINDING" }],
      });

      const workers = {
        hoox: { enabled: true, secrets: ["WEBHOOK_API_KEY_BINDING", "INTERNAL_KEY_BINDING"] },
      };

      const result = await checkWorkerSecrets(adapter, workers, "hoox");
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes("INTERNAL_KEY_BINDING"))).toBe(true);
    });

    it("returns success when all secrets exist", async () => {
      const adapter = createMockAdapter({
        listSecrets: async () => [
          { name: "WEBHOOK_API_KEY_BINDING" },
          { name: "INTERNAL_KEY_BINDING" },
        ],
      });

      const workers = {
        hoox: { enabled: true, secrets: ["WEBHOOK_API_KEY_BINDING", "INTERNAL_KEY_BINDING"] },
      };

      const result = await checkWorkerSecrets(adapter, workers, "hoox");
      expect(result.success).toBe(true);
    });

    it("skips disabled workers", async () => {
      const adapter = createMockAdapter({
        listSecrets: async () => [],
      });

      const workers = {
        hoox: { enabled: false, secrets: ["WEBHOOK_API_KEY_BINDING"] },
      };

      const result = await checkWorkerSecrets(adapter, workers);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("skips workers with no secrets", async () => {
      const adapter = createMockAdapter({
        listSecrets: async () => [],
      });

      const workers = {
        d1worker: { enabled: true, secrets: [] },
      };

      const result = await checkWorkerSecrets(adapter, workers);
      expect(result.success).toBe(true);
    });
  });

  describe("checkLocalSecrets", () => {
    it("returns error when .env.local not found", async () => {
      const result = await checkLocalSecrets("/nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("checkDevVars", () => {
    it("returns warning for missing .dev.vars", async () => {
      const workers = {
        hoox: { enabled: true, path: "workers/hoox" },
      };

      const result = await checkDevVars("/nonexistent", workers);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});