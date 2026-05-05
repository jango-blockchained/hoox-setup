import { NextResponse } from "next/server";
import { getEnvVar, ENV_KEYS } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function buildSignalOutcomesQuery(timeRange?: string): string {
  const timeFilter = timeRange ? `AND timestamp >= '${timeRange}'` : '';
  return `
    SELECT
      blob2 as source,
      blob3 as signal_type,
      blob4 as symbol,
      COUNT(*) as signal_count,
      AVG(double1) as avg_confidence
    FROM hoox-analytics
    WHERE blob1 = 'signal'
    ${timeFilter}
    GROUP BY blob2, blob3, blob4
    ORDER BY signal_count DESC
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
    const apiToken = getEnvVar(ENV_KEYS.cloudflare.apiToken) || "".trim();

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { success: false, error: "Cloudflare credentials not configured" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const timeRange = url.searchParams.get("timeRange") || undefined;

    const sql = buildSignalOutcomesQuery(timeRange);
    const data = await executeQuery(sql, accountId, apiToken);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
