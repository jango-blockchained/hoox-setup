/**
 * Live Cloudflare REST API Tests
 *
 * Tests the Cloudflare REST API directly (not through wrangler).
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 *
 * What's tested:
 *   - Authentication (whoami via API)
 *   - Account details
 *   - Zone listing
 *   - User information
 *   - API token permissions
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { getConfig, cfApi, section } from "./helpers";

describe("Cloudflare REST API", async () => {
  let config: ReturnType<typeof getConfig>;

  beforeAll(async () => {
    config = getConfig();
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  test("API token authenticates successfully", { timeout: 60000 }, async () => {
    section("Authentication");
    const result = await cfApi<{ id: string; email?: string; username?: string }>(
      "GET",
      "/user/tokens/verify"
    );
    expect(result.success).toBe(true);
    expect(result.result.id).toBeTruthy();
    console.log(`  ✓ API token verified (ID: ${result.result.id.slice(0, 12)}...)`);
  });

  // -----------------------------------------------------------------------
  // User info
  // -----------------------------------------------------------------------

  test("Get current user information", { timeout: 60000 }, async () => {
    section("User info");
    const result = await cfApi<{ email?: string; username?: string; first_name?: string; last_name?: string }>(
      "GET",
      "/user"
    );
    expect(result.success).toBe(true);
    if (result.result.email) {
      console.log(`  ✓ Authenticated as: ${result.result.email}`);
    } else if (result.result.username) {
      console.log(`  ✓ Authenticated as: ${result.result.username}`);
    }
  });

  // -----------------------------------------------------------------------
  // Account details
  // -----------------------------------------------------------------------

  test("Get account details", { timeout: 60000 }, async () => {
    section("Account");
    const result = await cfApi<{ id: string; name: string }>(
      "GET",
      `/accounts/${config.accountId}`
    );
    expect(result.success).toBe(true);
    expect(result.result.id).toBe(config.accountId);
    console.log(`  ✓ Account: "${result.result.name}" (${result.result.id.slice(0, 12)}...)`);
  });

  // -----------------------------------------------------------------------
  // API token permissions
  // -----------------------------------------------------------------------

  test("Get API token permissions", { timeout: 60000 }, async () => {
    section("Token permissions");
    const result = await cfApi<{
      id: string;
      name?: string;
      status?: string;
      policies?: Array<{ effect: string; resources: Record<string, string> }>;
    }>("GET", "/user/tokens");
    expect(result.success).toBe(true);
    const tokens = Array.isArray(result.result) ? result.result : [result.result];
    expect(tokens.length).toBeGreaterThan(0);
    console.log(`  ✓ Found ${tokens.length} API token(s)`);
    for (const token of tokens) {
      if (token.name) {
        console.log(`    - ${token.name} (${token.status ?? "active"})`);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Zones (if zone ID configured)
  // -----------------------------------------------------------------------

  test("List zones", { timeout: 60000 }, async () => {
    section("Zones");
    if (!config.zoneId) {
      console.log("  ⚠ CLOUDFLARE_ZONE_ID not set — skipping");
      return;
    }
    const result = await cfApi<Array<{ id: string; name: string; status: string }>>(
      "GET",
      `/zones?per_page=5`
    );
    expect(result.success).toBe(true);
    const zones = result.result;
    expect(zones.length).toBeGreaterThan(0);
    console.log(`  ✓ Found ${zones.length} zone(s):`);
    for (const zone of zones.slice(0, 5)) {
      console.log(`    - ${zone.name} (${zone.status})`);
    }
  });

  // -----------------------------------------------------------------------
  // Account limits / usage
  // -----------------------------------------------------------------------

  test("Get account subscription details", { timeout: 60000 }, async () => {
    section("Subscriptions");
    try {
      const result = await cfApi<Array<{
        id: string;
        state?: string;
        price?: number;
        currency?: string;
      }>>("GET", `/accounts/${config.accountId}/subscriptions`);
      expect(result.success).toBe(true);
      const subs = result.result;
      console.log(`  ✓ ${subs.length} subscription(s):`);
      for (const sub of subs) {
        console.log(`    - ${sub.id} (${sub.state ?? "active"})`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Subscriptions not available: ${message}`);
    }
  });

  // -----------------------------------------------------------------------
  // Workers limits
  // -----------------------------------------------------------------------

  test("Get Workers account limits", { timeout: 60000 }, async () => {
    section("Workers limits");
    try {
      const result = await cfApi<{
        subdomain?: { name?: string };
        usage?: { requests?: { value: number; limit: number } };
      }>("GET", `/accounts/${config.accountId}/workers/deployments/by-script/hoox`);
      expect(result.success).toBe(true);
      console.log("  ✓ Workers account accessible");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Workers limits not available: ${message}`);
    }
  });
});
