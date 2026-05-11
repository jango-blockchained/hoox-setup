import { NextResponse } from "next/server";
import { executeAnalyticsQuery } from "./shared";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function buildSignalOutcomesQuery(timeRange?: string): string {
  const timeFilter = timeRange ? `AND timestamp >= '${timeRange}'` : "";
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get("timeRange") || undefined;

    const sql = buildSignalOutcomesQuery(timeRange);
    const data = await executeAnalyticsQuery(sql);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
