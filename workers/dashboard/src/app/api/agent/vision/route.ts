import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createErrorResponse, Errors } from "@shared/errors";
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
      imageUrl?: string;
      imageBase64?: string;
      prompt?: string;
      model?: string;
    };

    const {
      imageUrl,
      imageBase64,
      prompt = "Analyze this image",
      model,
    } = body;

    if (!imageUrl && !imageBase64) {
      return Errors.badRequest("imageUrl or imageBase64 is required");
    }

    const env = getCloudflareContext().env as DashboardEnv & { AI?: any };

    let selectedModel = model;
    if (!selectedModel && env.CONFIG_KV) {
      const configData = await env.CONFIG_KV.get("agent:config");
      if (configData) {
        const raw = JSON.parse(configData);
        const parsed = agentConfigSchema.safeParse(raw);
        const config = parsed.success ? parsed.data : raw;
        if (!parsed.success) {
          console.warn("agent/vision: Invalid agent config schema");
        }
        selectedModel =
          config.modelMap?.["workers-ai"] ||
          "@cf/meta/llama-3.2-11b-vision-instruct";
      }
    }

    if (!selectedModel) {
      selectedModel = "@cf/meta/llama-3.2-11b-vision-instruct";
    }

    if (env.AI) {
      const imageData = imageBase64 || imageUrl;
      const result = await env.AI.run(selectedModel, {
        messages: [
          {
            role: "user",
            content: [
              { type: "image", image: imageData },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      return NextResponse.json({
        success: true,
        response: result.response || String(result),
        model: selectedModel,
      });
    }

    return NextResponse.json(
      { error: "AI binding not available" },
      { status: 500 }
    );
  } catch (e) {
    return Errors.internal(String(e));
  }
}
