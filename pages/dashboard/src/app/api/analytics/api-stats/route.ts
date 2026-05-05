import { NextResponse } from "next/server";
import { getEnvVar, ENV_KEYS } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function buildApiCallStatsQuery(exchange?: string): string {
  const exchangeFilter = exchange ? `AND blob3 = '${exchange}'` : '';
  return `
    SELECT
      blob3 as endpoint,
      COUNT(*) as call_count,
      AVG(double1) as avg_latency_ms,
      SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as success_count
    FROM hoox-analytics
    WHERE blob1 = 'api-call'
    ${exchangeFilter}
    GROUP BY blob3
    ORDER BY call_count DESC
  `.trim();
}

async function executeQuery(sql: string, accountId: string, apiToken: string) {
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

  return await response.json();
}

export async function GET(request: Request) {
  try {
    const accountId = getEnvVar(ENV_KEYS.cloudflare.accountId) || "";
    const apiToken = getEnvVar(ENV_KEYS.cloudflare.apiToken) || "";

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { success: false, error: "Cloudflare credentials not configured" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const exchange = url.searchParams.get("exchange") || undefined;

    const sql = buildApiCallStatsQuery(exchange);
    const data = await executeQuery(sql, accountId, apiToken);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
