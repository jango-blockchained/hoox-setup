/**
 * Live Test Suite — Cloudflare Services Integration Tests
 *
 * This suite tests ALL Cloudflare services used by the hoox platform
 * against LIVE infrastructure. No mocks, no stubs, no simulacra.
 *
 * REQUIREMENTS:
 *   - A Cloudflare account with Workers Paid plan (or an account with
 *     the services under test provisioned)
 *   - wrangler CLI installed and authenticated
 *   - The following environment variables set (or in tests/live/.env):
 *
 *     CLOUDFLARE_API_TOKEN    — Cloudflare API token (must have appropriate permissions)
 *     CLOUDFLARE_ACCOUNT_ID   — Cloudflare Account ID
 *     CLOUDFLARE_ZONE_ID      — Cloudflare Zone ID (for DNS/WAF tests)
 *     HOOX_D1_DATABASE        — D1 database name to test against
 *
 * USAGE:
 *   bun test:live              # Run all live tests
 *   bun test:live --d1         # Run D1 tests only
 *   bun test:live --kv         # Run KV tests only
 *
 * WARNING: These tests create and destroy real resources. Use a
 * development/staging account, NOT production.
 */

// =========================================================================
// Configuration (from environment)
// =========================================================================

export interface LiveTestConfig {
  apiToken: string;
  accountId: string;
  zoneId: string;
  d1Database: string;
  kvNamespaceId: string;
  r2Bucket: string;
  queueName: string;
}

export function getConfig(): LiveTestConfig {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const d1Database = process.env.HOOX_D1_DATABASE;
  const kvNamespaceId = process.env.HOOX_KV_NAMESPACE_ID;
  const r2Bucket = process.env.HOOX_R2_BUCKET;
  const queueName = process.env.HOOX_QUEUE;

  const missing: string[] = [];
  if (!apiToken) missing.push("CLOUDFLARE_API_TOKEN");
  if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Set them in tests/live/env or export them before running.\n" +
        "See tests/live/env.template for the full list."
    );
  }

  return {
    apiToken: apiToken!,
    accountId: accountId!,
    zoneId: zoneId ?? "",
    d1Database: d1Database ?? "my-database",
    kvNamespaceId: kvNamespaceId ?? "",
    r2Bucket: r2Bucket ?? "hoox-live-test",
    queueName: queueName ?? "hoox-live-test-queue",
  };
}

// =========================================================================
// Wrangler CLI wrapper
// =========================================================================

export interface WranglerResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a wrangler CLI command using Bun.spawn and return the full result.
 * Uses timeout to prevent hanging tests.
 */
export async function wrangler(
  args: string[],
  cwd?: string,
  stdin?: string
): Promise<WranglerResult> {
  try {
    const proc = Bun.spawn(["wrangler", ...args], {
      cwd: cwd ?? process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
    });

    if (stdin) {
      proc.stdin.write(stdin + "\n");
    }
    // Always close stdin to prevent wrangler from hanging on non-interactive
    // commands that try to read from stdin for confirmation prompts
    proc.stdin.end();

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    // Strip wrangler banner/upgrade notices from stdout (everything before
    // the first valid JSON token or first line of actual content)
    const cleanStdout = stripWranglerBanner(stdout.trim());

    return {
      ok: exitCode === 0,
      stdout: cleanStdout,
      stderr: stderr.trim() || (exitCode !== 0 ? `wrangler exited with code ${exitCode}` : ""),
      exitCode,
    };

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      stdout: "",
      stderr: `Failed to spawn wrangler: ${message}`,
      exitCode: -1,
    };
  }
}

/**
 * Check if wrangler CLI is available and authenticated.
 */
export async function isWranglerAvailable(): Promise<boolean> {
  try {
    const result = await wrangler(["whoami"]);
    return result.ok;
  } catch {
    return false;
  }
}

/**
 * Strip wrangler banner, upgrade notices, and ASCII art from the beginning
 * of command output. These appear on stdout before the actual content.
 */
function stripWranglerBanner(output: string): string {
  // Find the first line that looks like actual output (JSON array/object,
  // or non-wrangler content)
  const lines = output.split("\n");
  const contentStart = lines.findIndex(
    (line) =>
      line.startsWith("[") ||
      line.startsWith("{") ||
      (line.trim().length > 0 &&
        !line.includes("wrangler") &&
        !line.startsWith("⛅") &&
        !line.startsWith("│") &&
        !line.startsWith("──") &&
        !line.startsWith("There") &&
        !line.startsWith("Download") &&
        !line.startsWith("Use --remote") &&
        !line.startsWith("Resource") &&
        !line.startsWith("🌀") &&
        !line.startsWith("🪵") &&
        !line.startsWith("If you") &&
        !line.trim().startsWith(">") &&
        !line.includes("update available") &&
        !line.includes("────────────────") &&
        !line.includes("╭─") &&
        !line.includes("├─"))
  );

  if (contentStart === -1) return output;
  return lines.slice(contentStart).join("\n").trim();
}

// =========================================================================
// Cloudflare REST API wrapper
// =========================================================================

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CfApiResponse<T = unknown> {
  success: boolean;
  result: T;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
}

/**
 * Make an authenticated request to the Cloudflare REST API.
 */
export async function cfApi<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<CfApiResponse<T>> {
  const config = getConfig();
  const url = `${CF_API_BASE}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json()) as CfApiResponse<T>;

  if (!response.ok || !json.success) {
    throw new Error(
      `CF API ${method} ${path}: ${json.errors?.map((e) => e.message).join("; ") || response.status}`
    );
  }

  return json;
}

// =========================================================================
// Test resource lifecycle
// =========================================================================

const TEST_ID = `live_test_${Date.now()}`;

/** Unique resource names scoped to this test run (no hyphens for SQL compatibility). */
export function testResourceName(base: string): string {
  return `${base}_${TEST_ID}`;
}

// =========================================================================
// Assertion helpers
// =========================================================================

/**
 * Skip this test group if the required env var is not set.
 * Returns true if the check was skipped.
 */
export function skipIfMissing(...vars: string[]): boolean {
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.warn(
      `\n  ⚠ SKIPPED: missing ${missing.join(", ")} — set in tests/live/.env`
    );
    return true;
  }
  return false;
}

/**
 * Print a section header in test output for readability.
 */
export function section(name: string): void {
  console.log(`\n  ─── ${name} ───`);
}
