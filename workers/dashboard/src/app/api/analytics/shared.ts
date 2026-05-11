/**
 * Shared utilities for analytics API routes.
 * Extracted to eliminate duplicated `executeQuery` across 4 route files.
 */

import { getEnvVar, ENV_KEYS } from "@/lib/config";

/**
 * Execute a SQL query against Cloudflare Analytics Engine.
 * All 4 analytics routes follow the same pattern — this centralizes it.
 *
 * @returns The parsed JSON response from the Analytics Engine API
 * @throws If credentials are missing or the query fails
 */
export async function executeAnalyticsQuery(sql: string): Promise<unknown> {
  const accountId = getEnvVar(ENV_KEYS.cloudflare.accountId) || "";
  const apiToken = getEnvVar(ENV_KEYS.cloudflare.apiToken) || "";

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare credentials not configured");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: sql,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Query failed: ${response.status} ${errorText}`);
  }

  return response.json();
}
