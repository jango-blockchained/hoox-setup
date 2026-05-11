import { NextResponse } from "next/server";
import { executeAnalyticsQuery } from "./shared";

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
  const timeFilter = timeRange ? `AND timestamp >= '${timeRange}'` : "";
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const start =
      url.searchParams.get("start") ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = url.searchParams.get("end") || new Date().toISOString();
    const type = url.searchParams.get("type") || "metrics";

    let sql: string;
    if (type === "success-rate") {
      const timeRange = url.searchParams.get("timeRange") || undefined;
      sql = buildSuccessRateQuery(timeRange);
    } else {
      sql = buildTradeMetricsQuery(start, end);
    }

    const data = await executeAnalyticsQuery(sql);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
