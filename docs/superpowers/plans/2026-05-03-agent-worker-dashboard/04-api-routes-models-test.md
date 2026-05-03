### Task 4: API Routes - Models & Test-Model

**Files:**
- Create: `src/app/api/agent/models/route.ts`
- Create: `src/app/api/agent/test-model/route.ts`

- [ ] **Step 1: Create models/route.ts**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(_request: NextRequest) {
  try {
    const env = getCloudflareContext().env as unknown as {
      AI?: Ai;
    };

    const models = {
      "workers-ai": [
        { id: "@cf/meta/llama-3.1-8b-instruct", taskType: "chat" },
        { id: "@cf/meta/llama-3.2-11b-vision-instruct", taskType: "vision" },
        { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", taskType: "reasoning" },
        { id: "@cf/qwen/qwen2.5-coder-32b-instruct", taskType: "code" },
        { id: "@cf/baai/bge-base-en-v1.5", taskType: "embedding" },
        { id: "@cf/facebook/bart-large-cnn", taskType: "summarization" },
      ],
      "openai": [
        { id: "gpt-4o-mini-2024-07-18", taskType: "chat" },
        { id: "gpt-4o-2024-08-06", taskType: "chat" },
        { id: "o1-preview", taskType: "reasoning" },
        { id: "o1-mini", taskType: "reasoning" },
      ],
      "anthropic": [
        { id: "claude-3-haiku-20240307", taskType: "chat" },
        { id: "claude-3-sonnet-20240229", taskType: "chat" },
        { id: "claude-3-opus-20240229", taskType: "chat" },
      ],
      "google": [
        { id: "gemini-1.5-flash-002", taskType: "chat" },
        { id: "gemini-1.5-pro-002", taskType: "chat" },
      ],
      "azure": [
        { id: "gpt-4o-mini", taskType: "chat" },
        { id: "gpt-4o", taskType: "chat" },
      ],
    };

    return NextResponse.json({ success: true, models });
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create test-model/route.ts**

```tsx
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
      AI?: Ai;
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

    // For external providers, return a mock response (they need API keys)
    return NextResponse.json({
      success: true,
      provider,
      model: model || "unknown",
      response: `[Mock] ${provider} would respond to: ${prompt}`,
      latency: Date.now() - start,
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

- [ ] **Step 3: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/api/agent/models/route.ts
git add pages/dashboard/src/app/api/agent/test-model/route.ts
git commit -m "feat(dashboard): add agent API routes for models and test-model"
```
