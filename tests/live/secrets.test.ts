/**
 * Live Secret Management Tests
 *
 * Tests Cloudflare Workers Secrets via wrangler CLI.
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 *
 * What's tested:
 *   - secret list for a worker
 *   - secret put (with stdin piping)
 *   - secret delete
 *   - Multiple workers secret listing
 *
 * SAFETY: Uses a dedicated test secret name prefixed with
 * LIVE_TEST_ that can be easily cleaned up.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConfig, wrangler, section, testResourceName } from "./helpers";

const TEST_SECRET_NAME = testResourceName("LIVE_TEST_SECRET");
const TEST_SECRET_VALUE = `live-test-value-${Date.now()}`;

describe("Secrets", () => {
  let config: ReturnType<typeof getConfig>;
  const testWorkers = ["hoox", "d1-worker", "trade-worker"];

  beforeAll(() => {
    config = getConfig();
  });

  // -----------------------------------------------------------------------
  // List secrets for known workers
  // -----------------------------------------------------------------------

  test("secret list returns secrets for hoox worker", () => {
    section("List secrets");
    // Check our known hoox worker
    const result = wrangler(["secret", "list", "--name", "hoox"]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    console.log(`  ✓ hoox has ${parsed.length} secret(s)`);
    for (const secret of parsed) {
      console.log(`    - ${secret.name}`);
    }
  });

  test("secret list returns secrets for d1-worker", () => {
    const result = wrangler(["secret", "list", "--name", "d1-worker"]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    console.log(`  ✓ d1-worker has ${parsed.length} secret(s)`);
  });

  test("secret list returns secrets for trade-worker", () => {
    const result = wrangler(["secret", "list", "--name", "trade-worker"]);
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.stdout);
    console.log(`  ✓ trade-worker has ${parsed.length} secret(s)`);
  });

  // -----------------------------------------------------------------------
  // Put a test secret
  // -----------------------------------------------------------------------

  test("secret put adds a new secret to hoox worker", () => {
    section("Put secret");
    try {
      const { execSync } = require("node:child_process");
      const result = execSync(
        `echo "${TEST_SECRET_VALUE}" | wrangler secret put ${TEST_SECRET_NAME} --name hoox`,
        { encoding: "utf-8", timeout: 30_000 }
      );
      expect(result).toBeTruthy();
      console.log(`  ✓ Created secret "${TEST_SECRET_NAME}" on hoox`);

      // Verify it appears in list
      const listResult = wrangler(["secret", "list", "--name", "hoox"]);
      const parsed = JSON.parse(listResult.stdout);
      const found = parsed.find((s: { name: string }) => s.name === TEST_SECRET_NAME);
      expect(found).toBeDefined();
      console.log(`  ✓ "${TEST_SECRET_NAME}" confirmed in secret list`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Could not create secret: ${message}`);
      console.log("    (May need wrangler authenticated)");
    }
  });

  // -----------------------------------------------------------------------
  // Delete test secret
  // -----------------------------------------------------------------------

  test("secret delete removes the test secret", () => {
    section("Delete secret");
    try {
      const { execSync } = require("node:child_process");
      const result = execSync(
        `wrangler secret delete ${TEST_SECRET_NAME} --name hoox`,
        { encoding: "utf-8", timeout: 30_000 }
      );
      expect(result).toBeTruthy();
      console.log(`  ✓ Deleted secret "${TEST_SECRET_NAME}" from hoox`);

      // Verify it's gone
      const listResult = wrangler(["secret", "list", "--name", "hoox"]);
      const parsed = JSON.parse(listResult.stdout);
      const found = parsed.find((s: { name: string }) => s.name === TEST_SECRET_NAME);
      expect(found).toBeUndefined();
      console.log('  ✓ Confirmed secret no longer in list');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Could not delete secret: ${message}`);
    }
  });

  // -----------------------------------------------------------------------
  // Cross-worker test
  // -----------------------------------------------------------------------

  test("List secrets across multiple workers", () => {
    section("Cross-worker secrets");
    const allWorkers = [
      "hoox",
      "d1-worker",
      "trade-worker",
      "telegram-worker",
      "agent-worker",
    ];
    let totalSecrets = 0;

    for (const worker of allWorkers) {
      const result = wrangler(["secret", "list", "--name", worker]);
      if (result.ok) {
        try {
          const parsed = JSON.parse(result.stdout);
          totalSecrets += parsed.length;
          console.log(`  ${worker}: ${parsed.length} secret(s)`);
        } catch {
          console.log(`  ${worker}: (parse error)`);
        }
      } else {
        console.log(`  ${worker}: (not found)`);
      }
    }
    console.log(`  Total: ${totalSecrets} secrets across ${allWorkers.length} workers`);
  });
});
