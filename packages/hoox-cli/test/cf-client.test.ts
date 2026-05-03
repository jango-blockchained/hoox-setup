import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { CloudflareClient, createCFClient, createValidationResult, type CFConfig, type ValidationResult } from "../src/lib/cf-client.js";

// Mock fetch globally
const mockFetch = mock(() => Promise.resolve(new Response()));
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe("CloudflareClient", () => {
  let client: CloudflareClient;
  const config: CFConfig = {
    apiToken: "test-token-123",
    accountId: "test-account-456",
  };

  beforeEach(() => {
    client = new CloudflareClient(config);
    mockFetch.mockClear();
  });

  describe("constructor", () => {
    test("creates client with config", () => {
      expect(client).toBeDefined();
    });

    test("stores apiToken and accountId", () => {
      // Access private fields via type assertion for testing
      const clientAny = client as any;
      expect(clientAny.apiToken).toBe("test-token-123");
      expect(clientAny.accountId).toBe("test-account-456");
    });

    test("sets baseUrl correctly", () => {
      const clientAny = client as any;
      expect(clientAny.baseUrl).toBe("https://api.cloudflare.com/client/v4");
    });
  });

  describe("request() private method", () => {
    test("sends request with correct URL and headers", async () => {
      const mockResponse = { success: true, result: { test: "data" } };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      // Test via public method that uses request()
      const result = await client.listZones();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
            "Content-Type": "application/json",
          }),
        })
      );
      expect(result).toBeDefined();
    });

    test("throws on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );

      await expect(client.listZones()).rejects.toThrow("CF API error: 404");
    });

    test("throws on CF API success=false", async () => {
      const mockResponse = {
        success: false,
        errors: [{ message: "Invalid token" }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await expect(client.listZones()).rejects.toThrow("Invalid token");
    });

    test("includes custom headers", async () => {
      const mockResponse = { success: true, result: [] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await client.listZones();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        })
      );
    });
  });

  describe("D1 Database operations", () => {
    test("listD1Databases returns databases array", async () => {
      const mockResult = {
        success: true,
        result: [
          { uuid: "db-1", name: "test-db", title: "Test DB", created_at: "2024-01-01", version: 1 },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const databases = await client.listD1Databases();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/d1/databases",
        expect.any(Object)
      );
      expect(databases).toHaveLength(1);
      expect(databases[0].name).toBe("test-db");
    });

    test("createD1Database sends POST with name", async () => {
      const mockResult = {
        success: true,
        result: { uuid: "new-db", name: "my-db", title: "My DB", created_at: "2024-01-01", version: 1 },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const db = await client.createD1Database("my-db");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/d1/databases",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "my-db" }),
        })
      );
      expect(db.name).toBe("my-db");
    });

    test("getD1Database fetches specific database", async () => {
      const mockResult = {
        success: true,
        result: { uuid: "db-123", name: "specific-db", title: "Specific", created_at: "2024-01-01", version: 1 },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const db = await client.getD1Database("db-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/d1/databases/db-123",
        expect.any(Object)
      );
      expect(db.uuid).toBe("db-123");
    });

    test("deleteD1Database sends DELETE", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.deleteD1Database("db-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/d1/databases/db-123",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    test("executeD1Query sends SQL query", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.executeD1Query("db-123", "SELECT * FROM users");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/d1/databases/db-123/query",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ sql: "SELECT * FROM users" }),
        })
      );
    });
  });

  describe("R2 Bucket operations", () => {
    test("listR2Buckets returns buckets", async () => {
      const mockResult = {
        success: true,
        result: [{ name: "bucket-1", creation_date: "2024-01-01" }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const buckets = await client.listR2Buckets();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/r2/buckets",
        expect.any(Object)
      );
      expect(buckets).toHaveLength(1);
    });

    test("createR2Bucket sends POST", async () => {
      const mockResult = {
        success: true,
        result: { name: "new-bucket", creation_date: "2024-01-01" },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.createR2Bucket("new-bucket");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/r2/buckets",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "new-bucket" }),
        })
      );
    });

    test("deleteR2Bucket sends DELETE", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.deleteR2Bucket("bucket-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/r2/buckets/bucket-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("KV Namespace operations", () => {
    test("listKVNamespaces returns namespaces", async () => {
      const mockResult = {
        success: true,
        result: [{ id: "kv-1", title: "My KV", supports_url_encoding: true }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const namespaces = await client.listKVNamespaces();

      expect(namespaces).toHaveLength(1);
      expect(namespaces[0].title).toBe("My KV");
    });

    test("createKVNamespace sends POST", async () => {
      const mockResult = {
        success: true,
        result: { id: "new-kv", title: "New KV", supports_url_encoding: true },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const ns = await client.createKVNamespace("New KV");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/storage/kv/namespaces",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "New KV" }),
        })
      );
      expect(ns.title).toBe("New KV");
    });

    test("deleteKVNamespace sends DELETE", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.deleteKVNamespace("kv-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/storage/kv/namespaces/kv-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    test("getKVValue fetches value", async () => {
      const mockResult = { success: true, result: "my-value" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const value = await client.getKVValue("kv-1", "my-key");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/storage/kv/namespaces/kv-1/values/my-key",
        expect.any(Object)
      );
      expect(value).toBe("my-value");
    });

    test("getKVValue returns null for null result", async () => {
      const mockResult = { success: true, result: null };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const value = await client.getKVValue("kv-1", "missing-key");

      expect(value).toBeNull();
    });

    test("setKVValue sends PUT", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.setKVValue("kv-1", "my-key", "my-value");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/storage/kv/namespaces/kv-1/values",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ key: "my-key", value: "my-value" }),
        })
      );
    });

    test("deleteKVKey sends DELETE", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.deleteKVKey("kv-1", "my-key");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/storage/kv/namespaces/kv-1/values/my-key",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Queue operations", () => {
    test("listQueues returns queues", async () => {
      const mockResult = {
        success: true,
        result: [{ queue_name: "my-queue", production_queue_id: "q-1", dead_letter_queue: null }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const queues = await client.listQueues();

      expect(queues).toHaveLength(1);
      expect(queues[0].queue_name).toBe("my-queue");
    });

    test("createQueue sends POST", async () => {
      const mockResult = {
        success: true,
        result: { queue_name: "new-queue", production_queue_id: "q-2", dead_letter_queue: null },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const queue = await client.createQueue("new-queue");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/queues",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ queue_name: "new-queue" }),
        })
      );
      expect(queue.queue_name).toBe("new-queue");
    });

    test("deleteQueue sends DELETE", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.deleteQueue("my-queue");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/queues/my-queue",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Secret Store operations", () => {
    test("listSecrets returns secrets", async () => {
      const mockResult = {
        success: true,
        result: [{ name: "MY_SECRET", created: "2024-01-01", version: 1, expires_on: null }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const secrets = await client.listSecrets("store-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/secrets_store/bindings/store-123/secrets",
        expect.any(Object)
      );
      expect(secrets).toHaveLength(1);
    });

    test("getSecret fetches specific secret", async () => {
      const mockResult = {
        success: true,
        result: { name: "MY_SECRET", created: "2024-01-01", version: 1, expires_on: null },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const secret = await client.getSecret("store-123", "MY_SECRET");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/secrets_store/bindings/store-123/secrets/MY_SECRET",
        expect.any(Object)
      );
      expect(secret.name).toBe("MY_SECRET");
    });

    test("setSecret sends PUT with plaintext", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.setSecret("store-123", "MY_SECRET", "secret-value");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/secrets_store/bindings/store-123/secrets/MY_SECRET",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ plaintext: "secret-value" }),
        })
      );
    });

    test("deleteSecret sends DELETE", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.deleteSecret("store-123", "MY_SECRET");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/secrets_store/bindings/store-123/secrets/MY_SECRET",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Worker operations", () => {
    test("listWorkers returns workers", async () => {
      const mockResult = {
        success: true,
        result: [{ id: "w-1", script_name: "my-worker", created_on: "2024-01-01", modified_on: "2024-01-02", mvps_all_starts_at: null }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const workers = await client.listWorkers();

      expect(workers).toHaveLength(1);
      expect(workers[0].script_name).toBe("my-worker");
    });

    test("getWorker fetches specific worker", async () => {
      const mockResult = {
        success: true,
        result: { id: "w-1", script_name: "my-worker", created_on: "2024-01-01", modified_on: "2024-01-02", mvps_all_starts_at: null },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const worker = await client.getWorker("my-worker");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/workers/scripts/my-worker",
        expect.any(Object)
      );
      expect(worker.script_name).toBe("my-worker");
    });

    test("getWorkerVersions returns versions", async () => {
      const mockResult = {
        success: true,
        result: [{ version: "v1", deployed_on: "2024-01-01" }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const versions = await client.getWorkerVersions("my-worker");

      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe("v1");
    });

    test("rollbackWorker sends POST", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.rollbackWorker("my-worker", "v1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-456/workers/scripts/my-worker/rollback",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ version: "v1" }),
        })
      );
    });

    test("getWorkerAnalytics returns analytics", async () => {
      const mockResult = {
        success: true,
        result: {
          requests: { total: 100, cached: 80, uncached: 20 },
          dataTransfer: { uploaded: 1000, downloaded: 5000 },
          responseTime: 50,
          errors: 2,
        },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const analytics = await client.getWorkerAnalytics("my-worker");

      expect(analytics.requests.total).toBe(100);
      expect(analytics.errors).toBe(2);
    });
  });

  describe("DNS operations", () => {
    test("listZones returns zones", async () => {
      const mockResult = {
        success: true,
        result: [{ id: "zone-1", name: "example.com", status: "active" }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const zones = await client.listZones();

      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe("example.com");
    });

    test("listDNSRecords returns records", async () => {
      const mockResult = {
        success: true,
        result: [{ id: "rec-1", type: "A", name: "www.example.com", content: "1.2.3.4" }],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const records = await client.listDNSRecords("zone-1");

      expect(records).toHaveLength(1);
      expect(records[0].type).toBe("A");
    });

    test("addDNSRecord sends POST", async () => {
      const mockResult = {
        success: true,
        result: { id: "rec-2" },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const record = await client.addDNSRecord("zone-1", {
        type: "CNAME",
        name: "api.example.com",
        content: "example.com",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/zone-1/dns_records",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ type: "CNAME", name: "api.example.com", content: "example.com" }),
        })
      );
      expect(record.id).toBe("rec-2");
    });

    test("deleteDNSRecord sends DELETE", async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      await client.deleteDNSRecord("zone-1", "rec-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/zone-1/dns_records/rec-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});

describe("Helper functions", () => {
  test("createCFClient returns CloudflareClient instance", async () => {
    const config: CFConfig = {
      apiToken: "token",
      accountId: "account",
    };
    const client = await createCFClient(config);

    expect(client).toBeDefined();
    expect(typeof client.listZones).toBe("function");
    expect(typeof client.getD1Database).toBe("function");
    expect(typeof client.listKVNamespaces).toBe("function");
  });

  test("createValidationResult creates correct shape", () => {
    const result: ValidationResult = createValidationResult(
      true,
      [],
      ["warning"]
    );

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(["warning"]);
  });

  test("createValidationResult with failures", () => {
    const result = createValidationResult(
      false,
      ["error1", "error2"],
      []
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });
});
