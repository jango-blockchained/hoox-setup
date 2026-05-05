import { NextResponse } from "next/server";
import { getEnvVar, ENV_KEYS } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function buildTradeMetricsQuery(start: string, end: string): string {
  return `
    SELECT
      blob3 as exchange,
      COUNT(*) as trade_count,
      SUM(_sample_interval * double2) / SUM(_sample_interval) as avg_price,
      SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN blob2 = 'failure' THEN 1 ELSE 0 END) as failure_count
    FROM hoox-analytics
    WHERE blob1 = 'trade'
      AND timestamp >= '${start}'
      AND timestamp <= '${end}'
    GROUP BY blob3
  `.trim();
}

function buildSuccessRateQuery(timeRange?: string): string {
  const timeFilter = timeRange ? `AND timestamp >= '${timeRange}'` : '';
  return `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) as successes,
      (SUM(CASE WHEN blob2 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
    FROM hoox-analytics
    WHERE blob1 = 'trade'
    ${timeFilter}
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
    const start = url.searchParams.get("start") || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = url.searchParams.get("end") || new Date().toISOString();
    const type = url.searchParams.get("type") || "metrics";

    let sql: string;
    if (type === "success-rate") {
      const timeRange = url.searchParams.get("timeRange") || undefined;
      sql = buildSuccessRateQuery(timeRange);
    } else {
      sql = buildTradeMetricsQuery(start, end);
    }

    const data = await executeQuery(sql, accountId, apiToken);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
