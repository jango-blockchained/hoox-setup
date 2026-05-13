import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Errors } from "@shared/errors";
import type { DashboardEnv } from "@/lib/env";
import { z } from "zod";

const agentConfigSchema = z.object({
  defaultProvider: z.string().optional(),
  fallbackChain: z.array(z.string()).optional(),
  modelMap: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().optional(),
  retryCount: z.number().optional(),
  maxDailyDrawdownPercent: z.number().optional(),
  trailingStopPercent: z.number().optional(),
  takeProfitPercent: z.number().optional(),
});

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: "engage_kill_switch" | "release_kill_switch";
      trailingStopPercent?: number;
    };

    const { action, trailingStopPercent } = body;

    const env = getCloudflareContext().env as DashboardEnv;

    if (env.CONFIG_KV) {
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
        const raw = configData ? JSON.parse(configData) : {};
        const parsed = agentConfigSchema.safeParse(raw);
        const config = parsed.success ? parsed.data : raw;
        if (!parsed.success) {
          console.warn("agent/risk-override: Invalid agent config schema");
        }
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
