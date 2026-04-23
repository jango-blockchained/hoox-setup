import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST() {
  try {
    const agentUrl = process.env.AGENT_SERVICE_URL || process.env.agentService_URL || 'https://agent-worker.cryptolinx.workers.dev';
    const internalKey = process.env.AGENT_INTERNAL_KEY || process.env.D1_INTERNAL_KEY || '';
    
    const res = await fetch(`${agentUrl}/agent/housekeeping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": internalKey,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Agent responded with ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
