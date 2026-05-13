import { describe, expect, it } from "bun:test";
import { KvSyncService } from "./kv-sync-service.js";

describe("KvSyncService", () => {
  describe("getManifest", () => {
    it("returns manifest with CONFIG_KV namespace", () => {
      const manifest = KvSyncService.getManifest();
      expect(manifest.namespace).toBe("CONFIG_KV");
      expect(manifest.keys.length).toBeGreaterThan(10);
    });

    it("each key has required fields", () => {
      for (const key of KvSyncService.getManifestKeys()) {
        expect(key.key).toBeTruthy();
        expect(["boolean", "number", "string"]).toContain(key.type);
        expect(key.description).toBeTruthy();
        expect(typeof key.default).toBe("string");
      }
    });

    it("includes known critical keys", () => {
      const keys = KvSyncService.getManifestKeys().map((k) => k.key);
      expect(keys).toContain("trade:kill_switch");
      expect(keys).toContain("trade:max_daily_drawdown_percent");
      expect(keys).toContain("agent:openai_key");
      expect(keys).toContain("email:use_imap");
    });

    it("returns exactly 16 manifest keys", () => {
      expect(KvSyncService.getManifestKeys().length).toBe(16);
    });

    it("has no duplicates", () => {
      const keys = KvSyncService.getManifestKeys().map((k) => k.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
