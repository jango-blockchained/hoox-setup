import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      imageUrl?: string;
      imageBase64?: string;
      prompt?: string;
      model?: string;
    };

    const { imageUrl, imageBase64, prompt = "Analyze this image", model } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: "imageUrl or imageBase64 is required" },
        { status: 400 }
      );
    }

    const env = getCloudflareContext().env as unknown as {
      AI?: any;
      CONFIG_KV?: KVNamespace;
    };

    let selectedModel = model;
    if (!selectedModel && env.CONFIG_KV) {
      const configData = await env.CONFIG_KV.get("agent:config");
      if (configData) {
        const config = JSON.parse(configData);
        selectedModel = config.modelMap?.['workers-ai'] || "@cf/meta/llama-3.2-11b-vision-instruct";
      }
    }

    if (!selectedModel) {
      selectedModel = "@cf/meta/llama-3.2-11b-vision-instruct";
    }

    if (env.AI) {
      const imageData = imageBase64 || imageUrl;
      const result = await env.AI.run(selectedModel as any, {
        messages: [
          {
            role: "user",
            content: [
              { type: "image", image: imageData },
              { type: "text", text: prompt },
            ],
          },
        ],
      } as any);

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
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
