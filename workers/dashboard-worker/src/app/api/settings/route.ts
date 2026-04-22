import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const DEFAULT_WORKERS = ["hoox", "trade-worker", "d1-worker", "agent-worker", "telegram-worker", "email-worker"];

type Settings = Record<string, string | number | boolean>;
type AllSettings = Record<string, Settings>;

export async function GET() {
  const settings: AllSettings = {};

  for (const worker of DEFAULT_WORKERS) {
    try {
      const res = await fetch(`${process.env.D1_WORKER_URL}/api/settings/${worker}`, {
        headers: { "X-Internal-Auth-Key": process.env.D1_INTERNAL_KEY || "" },
      });

      if (res.ok) {
        const data = (await res.json()) as { settings?: Settings };
        settings[worker] = data.settings || {};
      }
    } catch {
      // Worker unavailable, use defaults
    }
  }

  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { worker?: string; key?: string; value?: string | number | boolean };
    const { worker, key, value } = body;

    if (!worker || !key) {
      return NextResponse.json({ error: "Missing worker or key" }, { status: 400 });
    }

    const res = await fetch(`${process.env.D1_WORKER_URL}/api/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": process.env.D1_INTERNAL_KEY || "",
      },
      body: JSON.stringify({ worker, key, value }),
    });

    if (!res.ok) {
      const error = (await res.json()) as { error?: string };
      return NextResponse.json({ error }, { status: res.status });
    }

    return NextResponse.json({ success: true, worker, key, value });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}