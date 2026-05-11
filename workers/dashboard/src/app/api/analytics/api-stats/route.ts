import { NextResponse } from "next/server";
import { executeAnalyticsQuery } from "./shared";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function buildApiCallStatsQuery(exchange?: string): string {
  const exchangeFilter = exchange ? `AND blob3 = '${exchange}'` : "";
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const exchange = url.searchParams.get("exchange") || undefined;

    const sql = buildApiCallStatsQuery(exchange);
    const data = await executeAnalyticsQuery(sql);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
