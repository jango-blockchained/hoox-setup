import { describe, it, expect, beforeEach, mock, afterEach } from "bun:test";
import { CloudflareAdapter } from "./cloudflare.js";
import { CloudflareClient } from "../lib/cf-client.js";
import { loadConfig } from "../configUtils.js";

// Mock the modules
mock.module("../lib/cf-client.js", () => {
  return {
    CloudflareClient: mock(() => ({
      listD1Databases: mock(() =>
        Promise.resolve([
          { uuid: "db1", name: "test-db", title: "test-db" },
        ])
      ),
      createD1Database: mock(() =>
        Promise.resolve({ uuid: "new-db", name: "my-db", title: "my-db" })
      ),
      deleteD1Database: mock(() => Promise.resolve()),
      listKVNamespaces: mock(() =>
        Promise.resolve([{ id: "kv1", title: "my-kv" }])
      ),
      createKVNamespace: mock(() =>
        Promise.resolve({ id: "new-kv", title: "new-kv" })
      ),
      deleteKVNamespace: mock(() => Promise.resolve()),
      listR2Buckets: mock(() =>
        Promise.resolve([{ name: "my-bucket" }])
      ),
      createR2Bucket: mock(() =>
        Promise.resolve({ name: "new-bucket" })
      ),
      deleteR2Bucket: mock(() => Promise.resolve()),
      listQueues: mock(() =>
        Promise.resolve([{ queue_name: "my-queue" }])
      ),
      createQueue: mock(() =>
        Promise.resolve({ queue_name: "new-queue" })
      ),
      deleteQueue: mock(() => Promise.resolve()),
      listZones: mock(() =>
        Promise.resolve([{ id: "zone1", name: "example.com", status: "active" }])
      ),
      listDNSRecords: mock(() =>
        Promise.resolve([{ id: "rec1", type: "A", name: "test", content: "1.2.3.4" }])
      ),
      addDNSRecord: mock(() =>
        Promise.resolve({ id: "new-rec" })
      ),
      deleteDNSRecord: mock(() => Promise.resolve()),
    })),
  };
});

mock.module("../configUtils.js", () => {
  return {
    loadConfig: mock(() =>
      Promise.resolve({
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
        },
      })
    ),
  };
});

describe("CloudflareAdapter", () => {
  let adapter: CloudflareAdapter;

  beforeEach(() => {
    adapter = new CloudflareAdapter();
  });

  describe("D1 Database methods", () => {
    it("should list D1 databases", async () => {
      const dbs = await adapter.listD1Databases();
      expect(dbs).toHaveLength(1);
      expect(dbs[0].name).toBe("test-db");
    });

    it("should create D1 database", async () => {
      const db = await adapter.createD1Database("my-db");
      expect(db.name).toBe("my-db");
    });

    it("should delete D1 database", async () => {
      await expect(adapter.deleteD1Database("db-uuid")).resolves.toBeUndefined();
    });
  });

  describe("KV Namespace methods", () => {
    it("should list KV namespaces", async () => {
      const namespaces = await adapter.listKVNamespaces();
      expect(namespaces).toHaveLength(1);
      expect(namespaces[0].title).toBe("my-kv");
    });

    it("should create KV namespace", async () => {
      const ns = await adapter.createKVNamespace("new-kv");
      expect(ns.title).toBe("new-kv");
    });

    it("should delete KV namespace", async () => {
      await expect(adapter.deleteKVNamespace("kv-id")).resolves.toBeUndefined();
    });
  });

  describe("R2 Bucket methods", () => {
    it("should list R2 buckets", async () => {
      const buckets = await adapter.listR2Buckets();
      expect(buckets).toHaveLength(1);
      expect(buckets[0].name).toBe("my-bucket");
    });

    it("should create R2 bucket", async () => {
      const bucket = await adapter.createR2Bucket("new-bucket");
      expect(bucket.name).toBe("new-bucket");
    });

    it("should delete R2 bucket", async () => {
      await expect(adapter.deleteR2Bucket("bucket-name")).resolves.toBeUndefined();
    });
  });

  describe("Queues methods", () => {
    it("should list queues", async () => {
      const queues = await adapter.listQueues();
      expect(queues).toHaveLength(1);
      expect(queues[0].queue_name).toBe("my-queue");
    });

    it("should create queue", async () => {
      const queue = await adapter.createQueue("new-queue");
      expect(queue.queue_name).toBe("new-queue");
    });

    it("should delete queue", async () => {
      await expect(adapter.deleteQueue("queue-name")).resolves.toBeUndefined();
    });
  });

  describe("Zones methods", () => {
    it("should list zones", async () => {
      const zones = await adapter.listZones();
      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe("example.com");
    });

    it("should list DNS records", async () => {
      const records = await adapter.listDNSRecords("zone-id");
      expect(records).toHaveLength(1);
      expect(records[0].type).toBe("A");
    });

    it("should add DNS record", async () => {
      const record = await adapter.addDNSRecord("zone-id", {
        type: "A",
        name: "test",
        content: "1.2.3.4",
      });
      expect(record.id).toBe("new-rec");
    });

    it("should delete DNS record", async () => {
      await expect(adapter.deleteDNSRecord("zone-id", "rec-id")).resolves.toBeUndefined();
    });
  });
});
