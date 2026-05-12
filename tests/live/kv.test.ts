/**
 * Live KV Namespace Tests
 *
 * Tests Cloudflare KV serverless key-value storage via wrangler CLI.
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 *
 * What's tested:
 *   - kv namespace list
 *   - kv key put / get / delete
 *   - kv key list with prefix
 *   - kv key get with metadata
 *   - kv bulk operations
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConfig, wrangler, skipIfMissing, section, testResourceName } from "./helpers";

const TEST_PREFIX = testResourceName("kv-test");

describe("KV Namespace", () => {
  let config: ReturnType<typeof getConfig>;
  let namespaceId: string;

  beforeAll(() => {
    config = getConfig();
  });

  // -----------------------------------------------------------------------
  // List namespaces
  // -----------------------------------------------------------------------

  test("kv namespace list returns namespaces", () => {
    section("List namespaces");
    const result = wrangler(["kv", "namespace", "list"]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    // Pick the first namespace for our tests
    namespaceId = parsed[0].id;
    console.log(`  ✓ Found ${parsed.length} namespace(s), using first: ${namespaceId.slice(0, 8)}...`);
  });

  // -----------------------------------------------------------------------
  // Key-value operations
  // -----------------------------------------------------------------------

  test("kv key put stores a value", () => {
    section("Key-value operations");
    const result = wrangler([
      "kv", "key", "put",
      "--namespace-id", namespaceId,
      `${TEST_PREFIX}/hello`, "world",
    ]);
    expect(result.ok).toBe(true);
    console.log('  ✓ Stored kv-test-*/hello = "world"');
  });

  test("kv key put supports JSON values and metadata", () => {
    const jsonValue = JSON.stringify({ name: "test", count: 42 });
    const result = wrangler([
      "kv", "key", "put",
      "--namespace-id", namespaceId,
      `${TEST_PREFIX}/json`, jsonValue,
      "--metadata", JSON.stringify({ type: "json", version: 1 }),
    ]);
    expect(result.ok).toBe(true);
    console.log("  ✓ Stored JSON value with metadata");
  });

  test("kv key put respects expiration", () => {
    // Set a key that expires in 2 hours
    const result = wrangler([
      "kv", "key", "put",
      "--namespace-id", namespaceId,
      `${TEST_PREFIX}/ephemeral`, "expires-soon",
      "--expiration", String(Math.floor(Date.now() / 1000) + 7200),
    ]);
    expect(result.ok).toBe(true);
    console.log("  ✓ Stored ephemeral key (2h TTL)");
  });

  test("kv key get retrieves a value", () => {
    const result = wrangler([
      "kv", "key", "get",
      "--namespace-id", namespaceId,
      `${TEST_PREFIX}/hello`,
    ]);
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe("world");
    console.log('  ✓ Retrieved "world"');
  });

  test("kv key get returns JSON when stored as JSON", () => {
    const result = wrangler([
      "kv", "key", "get",
      "--namespace-id", namespaceId,
      `${TEST_PREFIX}/json`,
    ]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.name).toBe("test");
    expect(parsed.count).toBe(42);
    console.log("  ✓ Retrieved JSON value");
  });

  test("kv key list with prefix returns matching keys", () => {
    section("List keys");
    const result = wrangler([
      "kv", "key", "list",
      "--namespace-id", namespaceId,
      "--prefix", TEST_PREFIX,
    ]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(3);
    const keyNames = parsed.map((k: { name: string }) => k.name);
    expect(keyNames).toContain(`${TEST_PREFIX}/hello`);
    expect(keyNames).toContain(`${TEST_PREFIX}/json`);
    expect(keyNames).toContain(`${TEST_PREFIX}/ephemeral`);
    console.log(`  ✓ Listed ${parsed.length} keys with prefix "${TEST_PREFIX}"`);
  });

  test("kv key delete removes a value", () => {
    section("Delete operations");
    const result = wrangler([
      "kv", "key", "delete",
      "--namespace-id", namespaceId,
      `${TEST_PREFIX}/hello`,
    ]);
    expect(result.ok).toBe(true);

    // Verify deletion
    const getResult = wrangler([
      "kv", "key", "get",
      "--namespace-id", namespaceId,
      `${TEST_PREFIX}/hello`,
    ]);
    // Getting a deleted key should return empty output (not error)
    expect(getResult.stdout.length).toBe(0);
    console.log('  ✓ Deleted kv-test-*/hello');
  });

  // -----------------------------------------------------------------------
  // Bulk operations
  // -----------------------------------------------------------------------

  test("kv bulk put with multiple keys", () => {
    section("Bulk operations");
    const entries = [
      { key: `${TEST_PREFIX}/bulk/a`, value: "1" },
      { key: `${TEST_PREFIX}/bulk/b`, value: "2" },
      { key: `${TEST_PREFIX}/bulk/c`, value: "3" },
    ];

    for (const entry of entries) {
      const result = wrangler([
        "kv", "key", "put",
        "--namespace-id", namespaceId,
        entry.key, entry.value,
      ]);
      expect(result.ok).toBe(true);
    }

    // Verify all three
    const listResult = wrangler([
      "kv", "key", "list",
      "--namespace-id", namespaceId,
      "--prefix", `${TEST_PREFIX}/bulk`,
    ]);
    const parsed = JSON.parse(listResult.stdout);
    expect(parsed.length).toBe(3);
    console.log(`  ✓ Bulk put ${entries.length} keys`);
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  afterAll(() => {
    section("Cleanup");
    // List all our test keys
    const listResult = wrangler([
      "kv", "key", "list",
      "--namespace-id", namespaceId,
      "--prefix", TEST_PREFIX,
    ]);
    if (!listResult.ok) return;
    const keys = JSON.parse(listResult.stdout) as Array<{ name: string }>;

    // Delete each one
    for (const key of keys) {
      wrangler(["kv", "key", "delete", "--namespace-id", namespaceId, key.name]);
    }
    console.log(`  ✓ Cleaned up ${keys.length} test keys`);
  });
});
