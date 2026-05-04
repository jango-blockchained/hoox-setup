import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createErrorResponse, Errors } from "@/shared/src/errors";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      prompt?: string;
      model?: string;
      reasoningEffort?: 'low' | 'medium' | 'high';
    };

    const { prompt, model = "o1-preview", reasoningEffort = "medium" } = body;

    if (!prompt) {
      return Errors.badRequest("Prompt is required");
    }

    const env = getCloudflareContext().env as unknown as {
      AI?: any;
      CONFIG_KV?: KVNamespace;
    };

    if (env.AI && model.includes('deepseek')) {
      const result = await env.AI.run(model as any, {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      } as any);

      return NextResponse.json({
        success: true,
        reasoning: (result as any).reasoning || "",
        answer: (result as any).response || String(result),
        model,
      });
    }

    return NextResponse.json({
      success: true,
      reasoning: `[Mock Reasoning - ${reasoningEffort} effort]\nLet me think through this step by step...\n1. First, I need to understand the problem.\n2. Then, I should analyze the options.\n3. Finally, I'll provide a comprehensive answer.`,
      answer: `[Mock Answer for "${prompt}" using ${model}]\n\nThis is a simulated response. Configure API keys in CONFIG_KV for real responses.`,
      model,
      note: "External providers require API keys in CONFIG_KV",
    });
  } catch (e) {
    return Errors.internal(String(e));
  }
}
