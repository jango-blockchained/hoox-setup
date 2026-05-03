### Task 6: API Routes - Usage, Prompts, Risk-Override

**Files:**
- Create: `src/app/api/agent/usage/route.ts`
- Create: `src/app/api/agent/prompts/route.ts`
- Create: `src/app/api/agent/risk-override/route.ts`

- [ ] **Step 1: Create usage/route.ts**

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
      // Get usage data from KV (stored by agent-worker)
      const usageData = await env.CONFIG_KV.get("agent:usage");
      
      if (usageData) {
        const usage = JSON.parse(usageData);
        return NextResponse.json({ success: true, usage });
      }

      // Return mock data if no usage tracked yet
      return NextResponse.json({
        success: true,
        usage: {
          "workers-ai": { requests: 850, tokens: 300000, cost: 0.00 },
          "openai": { requests: 320, tokens: 120000, cost: 9.60 },
          "anthropic": { requests: 77, tokens: 30000, cost: 2.75 },
        },
        note: "Mock data - usage tracking requires agent-worker to be running",
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

- [ ] **Step 2: Create prompts/route.ts**

```tsx
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(_request: NextRequest) {
  try {
    const templates = [
      "trading-analyst",
      "risk-assessor", 
      "market-scanner",
      "sentiment-analyzer",
      "position-advisor",
    ];

    return NextResponse.json({ success: true, prompts: templates });
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create risk-override/route.ts**

```tsx
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      action?: 'engage_kill_switch' | 'release_kill_switch';
      trailingStopPercent?: number;
    };

    const { action, trailingStopPercent } = body;

    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      // Handle kill switch
      if (action === 'engage_kill_switch') {
        await env.CONFIG_KV.put("trade:kill_switch", "true");
        return NextResponse.json({ 
          success: true, 
          message: "Kill switch engaged - trading disabled" 
        });
      }

      if (action === 'release_kill_switch') {
        await env.CONFIG_KV.put("trade:kill_switch", "false");
        return NextResponse.json({ 
          success: true, 
          message: "Kill switch released - trading enabled" 
        });
      }

      // Handle trailing stop update
      if (trailingStopPercent !== undefined) {
        const configData = await env.CONFIG_KV.get("agent:config");
        const config = configData ? JSON.parse(configData) : {};
        config.trailingStopPercent = trailingStopPercent;
        await env.CONFIG_KV.put("agent:config", JSON.stringify(config));
        
        return NextResponse.json({ 
          success: true, 
          config,
          message: `Trailing stop updated to ${trailingStopPercent * 100}%` 
        });
      }

      return NextResponse.json(
        { error: "No valid action specified" },
        { status: 400 }
      );
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
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/api/agent/usage/route.ts
git add pages/dashboard/src/app/api/agent/prompts/route.ts
git add pages/dashboard/src/app/api/agent/risk-override/route.ts
git commit -m "feat(dashboard): add agent API routes for usage, prompts, risk-override"
```
