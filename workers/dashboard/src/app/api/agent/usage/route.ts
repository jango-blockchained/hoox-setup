import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Errors } from "@shared/errors";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(_request: NextRequest) {
  try {
    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      const usageData = await env.CONFIG_KV.get("agent:usage");

      if (usageData) {
        const usage = JSON.parse(usageData);
        return NextResponse.json({ success: true, usage });
      }

      return NextResponse.json({
        success: true,
        usage: {
          "workers-ai": { requests: 850, tokens: 300000, cost: 0.0 },
          openai: { requests: 320, tokens: 120000, cost: 9.6 },
          anthropic: { requests: 77, tokens: 30000, cost: 2.75 },
        },
        note: "Mock data - usage tracking requires agent-worker to be running",
      });
    }

    return Errors.internal("CONFIG_KV not available");
  } catch (e) {
    return Errors.internal(String(e));
  }
}
