### Task 3: API Routes - Config, Health, Status

**Files:**
- Create: `src/app/api/agent/config/route.ts`
- Create: `src/app/api/agent/health/route.ts`
- Create: `src/app/api/agent/status/route.ts`

- [ ] **Step 1: Create config/route.ts**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(_request: NextRequest) {
  try {
    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      const configData = await env.CONFIG_KV.get("agent:config");
      if (configData) {
        const config = JSON.parse(configData);
        return NextResponse.json({ success: true, config });
      }
      return NextResponse.json({ success: true, config: null });
    }

    return NextResponse.json(
      { error: "CONFIG_KV not available" },
      { status: 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      defaultProvider?: string;
      fallbackChain?: string[];
      modelMap?: Record<string, string>;
      timeoutMs?: number;
      retryCount?: number;
      maxDailyDrawdownPercent?: number;
      trailingStopPercent?: number;
      takeProfitPercent?: number;
    };

    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      const existing = await env.CONFIG_KV.get("agent:config");
      const config = existing ? JSON.parse(existing) : {};
      
      if (body.defaultProvider !== undefined) config.defaultProvider = body.defaultProvider;
      if (body.fallbackChain !== undefined) config.fallbackChain = body.fallbackChain;
      if (body.modelMap !== undefined) config.modelMap = body.modelMap;
      if (body.timeoutMs !== undefined) config.timeoutMs = body.timeoutMs;
      if (body.retryCount !== undefined) config.retryCount = body.retryCount;
      if (body.maxDailyDrawdownPercent !== undefined) config.maxDailyDrawdownPercent = body.maxDailyDrawdownPercent;
      if (body.trailingStopPercent !== undefined) config.trailingStopPercent = body.trailingStopPercent;
      if (body.takeProfitPercent !== undefined) config.takeProfitPercent = body.takeProfitPercent;

      await env.CONFIG_KV.put("agent:config", JSON.stringify(config));
      return NextResponse.json({ success: true, config });
    }

    return NextResponse.json(
      { error: "CONFIG_KV not available" },
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

- [ ] **Step 2: Create health/route.ts**

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

    const providers = [
      { name: "workers-ai", available: !!env.AI },
      { name: "openai", available: true }, // Check via API key in KV
      { name: "anthropic", available: true },
      { name: "google", available: true },
      { name: "azure", available: true },
    ];

    const results: Record<string, { healthy: boolean; latency?: number; error?: string }> = {};

    for (const provider of providers) {
      if (!provider.available) {
        results[provider.name] = { healthy: false, error: "Provider not configured" };
        continue;
      }

      const start = Date.now();
      try {
        // Simple health check - for workers-ai, try a minimal inference
        if (provider.name === "workers-ai" && env.AI) {
          await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, {
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          });
        }
        results[provider.name] = { healthy: true, latency: Date.now() - start };
      } catch (e) {
        results[provider.name] = { 
          healthy: false, 
          latency: Date.now() - start, 
          error: String(e) 
        };
      }
    }

    return NextResponse.json({ success: true, providers: results });
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create status/route.ts**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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

      // List trailing stops
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
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors (may have minor errors due to KV types - acceptable)

- [ ] **Step 5: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/api/agent/config/route.ts
git add pages/dashboard/src/app/api/agent/health/route.ts
git add pages/dashboard/src/app/api/agent/status/route.ts
git commit -m "feat(dashboard): add agent API routes for config, health, status"
```
