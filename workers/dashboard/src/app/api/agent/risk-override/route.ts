import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Errors } from "@shared/errors";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: "engage_kill_switch" | "release_kill_switch";
      trailingStopPercent?: number;
    };

    const { action, trailingStopPercent } = body;

    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      if (action === "engage_kill_switch") {
        await env.CONFIG_KV.put("trade:kill_switch", "true");
        return NextResponse.json({
          success: true,
          message: "Kill switch engaged - trading disabled",
        });
      }

      if (action === "release_kill_switch") {
        await env.CONFIG_KV.put("trade:kill_switch", "false");
        return NextResponse.json({
          success: true,
          message: "Kill switch released - trading enabled",
        });
      }

      if (trailingStopPercent !== undefined) {
        const configData = await env.CONFIG_KV.get("agent:config");
        const config = configData ? JSON.parse(configData) : {};
        config.trailingStopPercent = trailingStopPercent;
        await env.CONFIG_KV.put("agent:config", JSON.stringify(config));
        return NextResponse.json({
          success: true,
          config,
          message: `Trailing stop updated to ${trailingStopPercent * 100}%`,
        });
      }

      return Errors.badRequest("No valid action specified");
    }

    return Errors.internal("CONFIG_KV not available");
  } catch (e) {
    return Errors.internal(String(e));
  }
}
