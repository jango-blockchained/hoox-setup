import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      provider?: string;
      model?: string;
      prompt?: string;
    };

    const { provider = "workers-ai", model, prompt = "Say hello" } = body;

    const env = getCloudflareContext().env as unknown as {
      AI?: any;
      CONFIG_KV?: KVNamespace;
    };

    const start = Date.now();

    if (provider === "workers-ai" && env.AI && model) {
      try {
        const result = await env.AI.run(model as any, {
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100,
        });
        return NextResponse.json({
          success: true,
          provider,
          model,
          response: (result as any).response || String(result),
          latency: Date.now() - start,
        });
      } catch (e) {
        return NextResponse.json({
          success: false,
          provider,
          model,
          error: String(e),
          latency: Date.now() - start,
        });
      }
    }

    return NextResponse.json({
      success: true,
      provider,
      model: model || "unknown",
      response: `[Mock] ${provider} would respond to: ${prompt}`,
      latency: Date.now() - start,
      note: "External providers require API keys in KV",
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
