### Task 5: API Routes - Chat (SSE), Vision, Reasoning

**Files:**
- Create: `src/app/api/agent/chat/route.ts`
- Create: `src/app/api/agent/vision/route.ts`
- Create: `src/app/api/agent/reasoning/route.ts`

- [ ] **Step 1: Create chat/route.ts with SSE streaming**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    };

    const { messages, model, temperature = 0.7, maxTokens = 500, stream = true } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    const env = getCloudflareContext().env as unknown as {
      AI?: Ai;
      CONFIG_KV?: KVNamespace;
    };

    // Get config for model selection
    let selectedModel = model;
    if (!selectedModel && env.CONFIG_KV) {
      const configData = await env.CONFIG_KV.get("agent:config");
      if (configData) {
        const config = JSON.parse(configData);
        selectedModel = config.modelMap?.[config.defaultProvider] || "@cf/meta/llama-3.1-8b-instruct";
      }
    }

    if (!selectedModel) {
      selectedModel = "@cf/meta/llama-3.1-8b-instruct";
    }

    if (stream && env.AI) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const result = await env.AI.run(selectedModel as any, {
              messages,
              temperature,
              max_tokens: maxTokens,
              stream: true,
            } as any);

            if (result && typeof result === 'object' && 'response' in result) {
              // Handle streaming response
              const aiStream = (result as any).response;
              if (aiStream && typeof aiStream.getReader === 'function') {
                const reader = aiStream.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = new TextDecoder().decode(value);
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
                  );
                }
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (e) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming fallback
    if (env.AI) {
      const result = await env.AI.run(selectedModel as any, {
        messages,
        temperature,
        max_tokens: maxTokens,
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
```

- [ ] **Step 2: Create vision/route.ts**

```tsx
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
      AI?: Ai;
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
```

- [ ] **Step 3: Create reasoning/route.ts**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const env = getCloudflareContext().env as unknown as {
      AI?: Ai;
      CONFIG_KV?: KVNamespace;
    };

    // For workers-ai reasoning models
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

    // For external providers (mock response)
    return NextResponse.json({
      success: true,
      reasoning: `[Mock Reasoning - ${reasoningEffort} effort]\nLet me think through this step by step...\n1. First, I need to understand the problem.\n2. Then, I should analyze the options.\n3. Finally, I'll provide a comprehensive answer.`,
      answer: `[Mock Answer for "${prompt}" using ${model}]\n\nThis is a simulated response. To use real reasoning models, configure API keys in CONFIG_KV.`,
      model,
      note: "External providers require API keys in CONFIG_KV",
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/api/agent/chat/route.ts
git add pages/dashboard/src/app/api/agent/vision/route.ts
git add pages/dashboard/src/app/api/agent/reasoning/route.ts
git commit -m "feat(dashboard): add agent API routes for chat (SSE), vision, reasoning"
```
