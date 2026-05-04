import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createErrorResponse, Errors } from "@/shared/src/errors";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(_request: NextRequest) {
  try {
    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      const killSwitch = await env.CONFIG_KV.get("trade:kill_switch");
      const configData = await env.CONFIG_KV.get("agent:config");
      const config = configData ? JSON.parse(configData) : null;

      const stopsList = await env.CONFIG_KV.list({ prefix: "trade:watermark:" });
      
      return NextResponse.json({
        success: true,
        status: {
          killSwitch: killSwitch === "true",
          config,
          activeStops: stopsList.keys.length,
          lastCheck: new Date().toISOString(),
        }
      });
    }

    return NextResponse.json(
      { error: "CONFIG_KV not available" },
      { status: 500 }
    );
  } catch (e) {
    return Errors.internal(String(e));
  }
}
