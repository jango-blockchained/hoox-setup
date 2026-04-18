import { describe, expect, test } from "bun:test";
import { loadConfig } from "../configUtils";

describe("Config Utils", () => {
  describe("loadConfig", () => {
    test("should load existing config.toml", async () => {
      const config = await loadConfig();
      expect(config).toBeDefined();
      expect(config.global).toBeDefined();
    });

    test("should have valid global config structure", async () => {
      const config = await loadConfig();
      expect(typeof config.global.cloudflare_api_token).toBe("string");
      expect(typeof config.global.cloudflare_account_id).toBe("string");
    });

    test("should have workers object", async () => {
      const config = await loadConfig();
      expect(config.workers).toBeDefined();
      expect(typeof config.workers).toBe("object");
    });
  });

  describe("Worker config validation", () => {
    test("should have workers with enabled field", async () => {
      const config = await loadConfig();
      for (const [, workerConfig] of Object.entries(config.workers)) {
        expect(typeof workerConfig.enabled).toBe("boolean");
        expect(typeof workerConfig.path).toBe("string");
      }
    });

    test("should have valid worker paths", async () => {
      const config = await loadConfig();
      for (const [, workerConfig] of Object.entries(config.workers)) {
        if (workerConfig.enabled) {
          expect(workerConfig.path).toMatch(/^workers\//);
        }
      }
    });
  });
});
