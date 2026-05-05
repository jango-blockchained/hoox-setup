import { NextResponse } from "next/server";
import { getEnvVar, ENV_KEYS } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function buildWorkerPerformanceQuery(worker: string, timeRange?: string): string {
  const timeFilter = timeRange ? `AND timestamp >= '${timeRange}'` : '';
  return `
    SELECT
      blob1 as data_type,
      SUM(double1) as total_requests,
      SUM(double2) as total_errors,
      AVG(double3) as avg_duration_ms
    FROM hoox-analytics
    WHERE blob1 IN ('worker-perf', 'api-call')
      AND blob2 = '${worker}'
      ${timeFilter}
    GROUP BY blob1
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
    const worker = url.searchParams.get("worker") || "";
    const timeRange = url.searchParams.get("timeRange") || undefined;

    if (!worker) {
      return NextResponse.json(
        { success: false, error: "Worker parameter is required" },
        { status: 400 }
      );
    }

    const sql = buildWorkerPerformanceQuery(worker, timeRange);
    const data = await executeQuery(sql, accountId, apiToken);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
