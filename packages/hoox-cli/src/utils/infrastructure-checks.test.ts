import { describe, it, expect } from "bun:test";
import {
  checkD1Database,
  checkKVNamespaces,
  checkR2Buckets,
  checkQueues,
  checkVectorizeIndex,
  checkAnalyticsEngine,
} from "./infrastructure-checks.js";
import { CloudflareAdapter } from "../adapters/cloudflare.js";

// Create mock adapter
function createMockAdapter(
  overrides: Record<string, unknown> = {}
): CloudflareAdapter {
  return {
    listD1Databases: overrides.listD1Databases || (async () => []),
    listKVNamespaces: overrides.listKVNamespaces || (async () => []),
    listR2Buckets: overrides.listR2Buckets || (async () => []),
    listQueues: overrides.listQueues || (async () => []),
    ...overrides,
  } as unknown as CloudflareAdapter;
}

describe("infrastructure checks", () => {
  describe("checkD1Database", () => {
    it("returns success when D1 database exists", async () => {
      const adapter = createMockAdapter({
        listD1Databases: async () => [
          { name: "trade-data-db", uuid: "abc123" },
        ],
      });
      const result = await checkD1Database(adapter, "trade-data-db");
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("returns error when D1 database is missing", async () => {
      const adapter = createMockAdapter({
        listD1Databases: async () => [],
      });
      const result = await checkD1Database(adapter, "trade-data-db");
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("returns error when listing fails", async () => {
      const adapter = createMockAdapter({
        listD1Databases: async () => {
          throw new Error("API error");
        },
      });
      const result = await checkD1Database(adapter, "trade-data-db");
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Failed to list");
    });
  });

  describe("checkKVNamespaces", () => {
    it("returns success when all KV namespaces exist", async () => {
      const adapter = createMockAdapter({
        listKVNamespaces: async () => [
          { id: "c5917667a21745e390ff969f32b1847d", title: "CONFIG_KV" },
          { id: "ff70a58b492e45d79880a7a8213c745c", title: "SESSIONS_KV" },
        ],
      });
      const result = await checkKVNamespaces(adapter, [
        { binding: "CONFIG_KV", id: "c5917667a21745e390ff969f32b1847d" },
        { binding: "SESSIONS_KV", id: "ff70a58b492e45d79880a7a8213c745c" },
      ]);
      expect(result.success).toBe(true);
    });

    it("returns error when KV namespace is missing", async () => {
      const adapter = createMockAdapter({
        listKVNamespaces: async () => [],
      });
      const result = await checkKVNamespaces(adapter, [
        { binding: "CONFIG_KV", id: "c5917667a21745e390ff969f32b1847d" },
      ]);
      expect(result.success).toBe(false);
    });
  });

  describe("checkR2Buckets", () => {
    it("returns success when all R2 buckets exist", async () => {
      const adapter = createMockAdapter({
        listR2Buckets: async () => [
          { name: "trade-reports" },
          { name: "hoox-system-logs" },
          { name: "user-uploads" },
        ],
      });
      const result = await checkR2Buckets(adapter, [
        "trade-reports",
        "hoox-system-logs",
        "user-uploads",
      ]);
      expect(result.success).toBe(true);
    });

    it("returns error when R2 bucket is missing", async () => {
      const adapter = createMockAdapter({
        listR2Buckets: async () => [{ name: "trade-reports" }],
      });
      const result = await checkR2Buckets(adapter, [
        "trade-reports",
        "missing-bucket",
      ]);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("missing-bucket");
    });
  });

  describe("checkQueues", () => {
    it("returns success when all queues exist", async () => {
      const adapter = createMockAdapter({
        listQueues: async () => [{ queue_name: "trade-execution" }],
      });
      const result = await checkQueues(adapter, ["trade-execution"]);
      expect(result.success).toBe(true);
    });

    it("returns error when queue is missing", async () => {
      const adapter = createMockAdapter({
        listQueues: async () => [],
      });
      const result = await checkQueues(adapter, ["trade-execution"]);
      expect(result.success).toBe(false);
    });
  });

  describe("checkVectorizeIndex", () => {
    it("returns warning (manual verification needed)", async () => {
      const adapter = createMockAdapter();
      const result = await checkVectorizeIndex(adapter, "my-rag-index");
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("checkAnalyticsEngine", () => {
    it("returns warning (manual verification needed)", async () => {
      const result = await checkAnalyticsEngine("hoox-analytics");
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
