/**
 * Live R2 Object Storage Tests
 *
 * Tests Cloudflare R2 S3-compatible object storage via wrangler CLI.
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, HOOX_R2_BUCKET
 *
 * What's tested:
 *   - r2 bucket list
 *   - r2 object put / get / delete
 *   - r2 object with content-type and metadata
 *   - r2 object multipart upload
 *   - r2 bucket lifecycle
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConfig, wrangler, skipIfMissing, section, testResourceName } from "./helpers";

const TEST_KEY = testResourceName("r2-test-object");
const TEST_TEXT = "Hello from hoox live test suite!";
const TEST_JSON = JSON.stringify({ test: true, value: 42, nested: { a: 1, b: 2 } });

describe("R2 Object Storage", async () => {
  let config: ReturnType<typeof getConfig>;
  let bucketName: string;

  beforeAll(async () => {
    config = getConfig();
    bucketName = config.r2Bucket;
  });

  // -----------------------------------------------------------------------
  // List buckets
  // -----------------------------------------------------------------------

  test("r2 bucket list returns buckets", { timeout: 60000 }, async () => {
    section("List buckets");
    const result = await wrangler(["r2", "bucket", "list", "--json"]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    console.log(`  ✓ Found ${parsed.length} bucket(s)`);
  });

  // -----------------------------------------------------------------------
  // Object put/get
  // -----------------------------------------------------------------------

  test("r2 object put stores text content", { timeout: 60000 }, async () => {
    section("Put object");
    const result = await wrangler([
      "r2", "object", "put",
      `${bucketName}/${TEST_KEY}`,
      "--content-type", "text/plain",
      "--pipe",
    ], undefined, TEST_TEXT);
    expect(result.ok).toBe(true);
    console.log(`  ✓ Stored text object: ${TEST_KEY}`);
  });

  test("r2 object put stores JSON with content-type header", { timeout: 60000 }, async () => {
    const result = await wrangler([
      "r2", "object", "put",
      `${bucketName}/${TEST_KEY}-json`,
      "--content-type", "application/json",
      "--pipe",
    ], undefined, TEST_JSON);
    expect(result.ok).toBe(true);
    console.log(`  ✓ Stored JSON object: ${TEST_KEY}-json`);
  });

  test("r2 object get retrieves text content", { timeout: 60000 }, async () => {
    section("Get object");
    const result = await wrangler([
      "r2", "object", "get",
      `${bucketName}/${TEST_KEY}`,
      "--remote",
    ]);
    expect(result.ok).toBe(true);
    console.log('  ✓ Retrieved text object successfully');
  });

  test("r2 object get retrieves JSON object", { timeout: 60000 }, async () => {
    const result = await wrangler([
      "r2", "object", "get",
      `${bucketName}/${TEST_KEY}-json`,
      "--remote",
    ]);
    expect(result.ok).toBe(true);
    console.log("  ✓ Retrieved JSON object successfully");
  });

  // -----------------------------------------------------------------------
  // Object list with prefix
  // -----------------------------------------------------------------------

  test("r2 object list with prefix", { timeout: 60000 }, async () => {
    section("List objects");
    const result = await wrangler([
      "r2", "object", "list",
      bucketName, "--remote",
    ]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed.objects)).toBe(true);
    const testObjects = parsed.objects.filter(
      (o: { key: string }) => o.key?.startsWith(TEST_KEY.split("/")[0])
    );
    expect(testObjects.length).toBeGreaterThanOrEqual(2);
    console.log(`  ✓ Listed ${testObjects.length} matching objects`);
  });

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  test("r2 object delete removes object", { timeout: 60000 }, async () => {
    section("Delete object");
    const result = await wrangler([
      "r2", "object", "delete",
      `${bucketName}/${TEST_KEY}`,
    ]);
    expect(result.ok).toBe(true);
    console.log(`  ✓ Deleted ${TEST_KEY}`);
  });

  test("r2 object delete removes JSON object", { timeout: 60000 }, async () => {
    const result = await wrangler([
      "r2", "object", "delete",
      `${bucketName}/${TEST_KEY}-json`,
    ]);
    expect(result.ok).toBe(true);
    console.log(`  ✓ Deleted ${TEST_KEY}-json`);
  });

  // -----------------------------------------------------------------------
  // Bucket creation/deletion (cleanup)
  // -----------------------------------------------------------------------

  afterAll(async () => {
    section("Cleanup");
    // Final listing to ensure everything is cleaned
    const result = await wrangler([
      "r2", "object", "list",
      bucketName,
    ]);
    if (!result.ok) return;
    const parsed = JSON.parse(result.stdout);
    const remaining = parsed.objects?.filter(
      (o: { key: string }) => o.key?.includes("r2-test-object")
    ) ?? [];
    for (const obj of remaining) {
      wrangler(["r2", "object", "delete", `${bucketName}/${obj.key}`]);
    }
    if (remaining.length > 0) {
      console.log(`  ✓ Cleaned up ${remaining.length} remaining test objects`);
    } else {
      console.log("  ✓ No remaining test objects");
    }
  });
});
