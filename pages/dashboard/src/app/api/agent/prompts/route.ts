import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(_request: NextRequest) {
  try {
    const templates = [
      "trading-analyst",
      "risk-assessor", 
      "market-scanner",
      "sentiment-analyzer",
      "position-advisor",
    ];

    return NextResponse.json({ success: true, prompts: templates });
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
