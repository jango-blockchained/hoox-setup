import { describe, expect, it } from "bun:test";
import { KvSyncService } from "../../services/kv/index.js";

describe("kv command", () => {
  describe("manifest", () => {
    it("returns known KV keys from manifest", () => {
      const keys = KvSyncService.getManifestKeys();
      expect(keys.length).toBe(16);
      expect(keys.some((k) => k.key === "trade:kill_switch")).toBe(true);
      expect(keys.some((k) => k.key === "agent:openai_key")).toBe(true);
      expect(keys.some((k) => k.key === "email:use_imap")).toBe(true);
    });
  });
});
