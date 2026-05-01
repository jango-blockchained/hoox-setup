import { NextResponse } from "next/server";
import { ENV_KEYS, getConfig, validateRequiredEnv } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST() {
  try {
    const configErrors = validateRequiredEnv([ENV_KEYS.internalAuth.agent]);
    if (configErrors.length > 0) {
      return NextResponse.json({ error: "Configuration error", missing: configErrors }, { status: 500 });
    }

    const res = await fetch(`${getConfig().api.agentService}/agent/housekeeping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": getConfig().internalAuth.agent || "",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Agent responded with ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
