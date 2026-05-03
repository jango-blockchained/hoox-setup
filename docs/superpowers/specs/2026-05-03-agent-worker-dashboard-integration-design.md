# Agent Worker Dashboard Integration - Design Spec

> **Date:** 2026-05-03
> **Status:** Approved
> **Scope:** Full integration of agent-worker into the Next.js dashboard

## Overview

Integrate the `agent-worker` (AI & Risk Manager) into the Next.js 16 dashboard with dedicated pages for chat, vision analysis, reasoning, model configuration, risk management, and usage statistics.

## Architecture

```
Dashboard (Next.js Edge)          Agent Worker (Cloudflare)
┌──────────────────────┐           ┌──────────────────────┐
│  /dashboard/agent/* │           │  /agent/*            │
│                     │    API    │                      │
│  API Routes        ├──────────►│  Handlers           │
│  (proxy requests)  │           │  (config, chat,     │
│                     │◄──────────┤   vision, reasoning)│
│  SSE Streaming     │    SSE    │                      │
│  (chat page)       │           │  KV Config Store    │
└──────────────────────┘           └──────────────────────┘
```

### Key Decisions
- **Dedicated pages** (not tabs) to match existing dashboard patterns (positions, logs, setup each have their own page)
- **API routes as proxies** to agent-worker endpoints, using existing `getCloudflareContext().env` for KV/Service Binding access
- **shadcn/ui components** used throughout per project standards (Card, Button, Input, Select, Tabs, Table, Chart, etc.)

## Pages

### 1. Overview (`/dashboard/agent`)

Landing page showing agent status, quick actions, configuration summary, and recent activity.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "AI Agent" + "Risk Manager"                    │
│  Subtitle: "Monitor and control the AI trading agent"   │
├─────────────────────────────────────────────────────────┤
│  [Status Card]              [Quick Actions Card]        │
│  • Status: Active         • Test Model Button          │
│  • Provider: Workers AI   • View Health Button         │
│  • Last Run: 2m ago      • Override Risk Button       │
├─────────────────────────────────────────────────────────┤
│  [Configuration Summary Card]                           │
│  • Default Provider: workers-ai                        │
│  • Fallback Chain: workers-ai → openai → anthropic    │
│  • Trailing Stop: 5%                                  │
│  • Take Profit: 10%                                   │
│  • Max Drawdown: -5%                                  │
├─────────────────────────────────────────────────────────┤
│  [Recent Activity Card]                                 │
│  • 2 min ago: Health check passed                      │
│  • 7 min ago: Position BTC closed (take profit)        │
│  • 12 min ago: Chat query processed                    │
└─────────────────────────────────────────────────────────┘
```

**Components:** `Card` (with `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`), `Badge`, `Button` (with `data-icon`), `Separator`, `Progress`

---

### 2. Chat (`/dashboard/agent/chat`)

AI chat interface with SSE streaming support, model selection, temperature control, and token limits.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "AI Chat" + "SSE Streaming"                   │
├─────────────────────────────────────────────────────────┤
│  [Chat Container - ScrollArea]                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Assistant: "How can I help with your trading?"  │   │
│  │                                                   │   │
│  │ User: "Analyze BTC market sentiment"            │   │
│  │ Assistant: "Based on current market conditions │   │
│  │ [streaming...]"                                 │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  [Model Selector] [Temperature Slider] [Max Tokens]    │
├─────────────────────────────────────────────────────────┤
│  [Message Input]                              [Send]   │
│  (Input with Button using InputGroup)                   │
└─────────────────────────────────────────────────────────┘
```

**Components:** `Card`, `ScrollArea`, `Select`, `Slider`, `InputGroup` + `InputGroupInput` + `InputGroupAddon`, `Button` (with `data-icon="inline-end"`)

**SSE Streaming:** Use `ReadableStream` API to process `text/event-stream` responses and update state in real-time.

---

### 3. Vision (`/dashboard/agent/vision`)

Upload chart images for AI vision analysis with prompt input and results display.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "Vision Analysis" + "Chart Image Analysis"     │
├─────────────────────────────────────────────────────────┤
│  [Upload Card]                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Drop zone / Click to upload                   │   │
│  │  (Supports PNG, JPG, WebP)                   │   │
│  └─────────────────────────────────────────────────┘   │
│  [Image Preview]                                      │
│  [Prompt Input - Textarea]                             │
│  [Model Selector] [Analyze Button]                     │
├─────────────────────────────────────────────────────────┤
│  [Results Card]                                        │
│  • Support Levels: $92,000, $90,500                   │
│  • Resistance: $95,000, $98,000                       │
│  • Trend: Bullish divergence on 4H                      │
└─────────────────────────────────────────────────────────┘
```

**Components:** `Card`, `Input` (file type), `Textarea`, `Select`, `Button`, `Alert` (for results), `Empty` (before upload)

---

### 4. Reasoning (`/dashboard/agent/reasoning`)

Deep thinking queries with o1-style models, showing reasoning process and final answer in tabs.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "Reasoning" + "Deep Thinking (o1-style)"        │
├─────────────────────────────────────────────────────────┤
│  [Model Selector Card]                                  │
│  • Model: o1-preview / o1-mini / deepseek-r1         │
│  • Reasoning Effort: [Low] [Medium] [High] (ToggleGroup)│
├─────────────────────────────────────────────────────────┤
│  [Prompt Input Card]                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ "Design a risk management strategy for a      │   │
│  │  $100k portfolio..."                         │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│  [Submit Button]                                      │
├─────────────────────────────────────────────────────────┤
│  [Response Card - Tabs]                                │
│  ┌─────────┬──────────┐                              │
│  │Reasoning │ Answer   │                              │
│  ├─────────┼──────────┤                              │
│  │"Let me  │"Here's  │                              │
│  │think     │a         │                              │
│  │through    │comprehensive...│                        │
│  │this...   │          │                              │
│  └─────────┴──────────┘                              │
└─────────────────────────────────────────────────────────┘
```

**Components:** `Card`, `Select`, `ToggleGroup` + `ToggleGroupItem`, `Textarea`, `Button`, `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent`, `Skeleton` (loading)

---

### 5. Models (`/dashboard/agent/models`)

Provider configuration, health checks, and model testing with tabbed interface.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "AI Models" + "Provider Configuration"          │
├─────────────────────────────────────────────────────────┤
│  [Tabs: Provider Config | Health Check | Test Model]    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Provider Config Tab]                          │   │
│  │ Default Provider: [workers-ai ▼]              │   │
│  │                                                 │   │
│  │ Fallback Chain:                                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │workers-ai│ │ openai   │ │anthropic │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘    │   │
│  │                                                 │   │
│  │ Model Mappings:                                 │   │
│  │ workers-ai  → @cf/meta/llama-3.1-8b... [Edit]│  │
│  │ openai       → gpt-4o-mini-2024-07-18 [Edit] │  │
│  │                                                 │   │
│  │ [Save Configuration Button]                      │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Health Check Tab]                              │   │
│  │ ┌─────────┬─────────┬─────────┬─────────┐    │   │
│  │ │Provider  │Status   │Latency  │Action   │    │   │
│  │ ├─────────┼─────────┼─────────┼─────────┤    │   │
│  │ │workers-ai│✓ Healthy│150ms    │[Test]   │    │   │
│  │ │openai    │✓ Healthy│200ms    │[Test]   │    │   │
│  │ │anthropic │✗ Error  │-        │[Test]   │    │   │
│  │ └─────────┴─────────┴─────────┴─────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Test Model Tab]                               │   │
│  │ Provider: [openai ▼] Model: [gpt-4o-mini ▼] │   │
│  │ Prompt: "Say hello"                            │   │
│  │ [Run Test Button]                              │   │
│  │ Result: "Hello! How can I help you today?"     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Components:** `Tabs`, `Select`, `Input`, `Table` + `TableHeader` + `TableBody` + `TableRow` + `TableCell`, `Button`, `Badge`, `Card`

---

### 6. Risk (`/dashboard/agent/risk`)

Risk parameters, kill switch override, and active trailing stops monitoring.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "Risk Management" + "Parameters & Overrides"    │
├─────────────────────────────────────────────────────────┤
│  [Alert: Kill Switch Status]                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⚠️ Kill Switch: [ACTIVE]                      │   │
│  │ Trading is currently blocked due to drawdown    │   │
│  │ [Release Kill Switch Button]                   │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  [Risk Parameters Card]                                │
│  • Max Daily Drawdown: [-5%] (Slider -10% to 0%)     │
│  • Trailing Stop: [5%] (Slider 1% to 20%)             │
│  • Take Profit: [10%] (Slider 1% to 50%)              │
│  [Save Parameters Button]                              │
├─────────────────────────────────────────────────────────┤
│  [Active Trailing Stops Card - Table]                   │
│  ┌─────────┬─────────┬─────────┬─────────┬────────┐ │
│  │Symbol   │Side     │Entry    │Current  │Stop    │ │
│  ├─────────┼─────────┼─────────┼─────────┼────────┤ │
│  │BTCUSDT  │LONG     │$92,000  │$94,500  │$89,500 │ │
│  │ETHUSDT  │SHORT    │$3,500   │$3,400   │$3,700  │ │
│  └─────────┴─────────┴─────────┴─────────┴────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Components:** `Alert` + `AlertTitle` + `AlertDescription`, `Slider`, `Card`, `Table`, `Button`, `Switch`

---

### 7. Usage (`/dashboard/agent/usage`)

Usage statistics with charts and provider breakdown table.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "Usage Statistics" + "AI API Consumption"        │
├─────────────────────────────────────────────────────────┤
│  [Summary Cards - 3 columns]                            │
│  ┌──────────────┬──────────────┬──────────────┐       │
│  │Total Requests│Total Tokens  │Est. Cost     │       │
│  │    1,247     │   450,000    │    $12.35    │       │
│  └──────────────┴──────────────┴──────────────┘       │
├─────────────────────────────────────────────────────────┤
│  [Usage Chart Card - Area Chart]                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  (AreaChart showing tokens per day per provider)│   │
│  │  workers-ai: ████████                          │   │
│  │  openai:      █████                             │   │
│  │  anthropic:   ██                                │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  [Provider Breakdown Table]                             │
│  ┌─────────┬─────────┬─────────┬─────────┬────────┐ │
│  │Provider  │Requests │Tokens   │Avg Lat. │Cost    │ │
│  ├─────────┼─────────┼─────────┼─────────┼────────┤ │
│  │workers-ai│  850    │ 300,000 │ 150ms   │ $0.00  │ │
│  │openai    │  320    │ 120,000 │ 200ms   │ $9.60  │ │
│  │anthropic │   77    │  30,000 │ 350ms   │ $2.75  │ │
│  └─────────┴─────────┴─────────┴─────────┴────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Components:** `Card`, `Chart` (AreaChart), `Table`, `Badge`, `Tabs` (for time range: 24h | 7d | 30d)

---

## API Routes

All routes use `getCloudflareContext().env` to access KV and Service Bindings.

| Route | Method | Proxies To | Description |
|-------|--------|-------------|-------------|
| `/api/agent/config` | GET/POST | `agent-worker/config` | Get/update agent configuration |
| `/api/agent/chat` | POST | `agent-worker/chat` | Chat with SSE streaming |
| `/api/agent/models` | GET | `agent-worker/models` | List available models |
| `/api/agent/test-model` | POST | `agent-worker/test-model` | Test a specific model |
| `/api/agent/vision` | POST | `agent-worker/vision` | Analyze image with vision |
| `/api/agent/reasoning` | POST | `agent-worker/reasoning` | Deep thinking queries |
| `/api/agent/usage` | GET | `agent-worker/usage` | Get usage statistics |
| `/api/agent/health` | GET | `agent-worker/health` | Health check all providers |
| `/api/agent/status` | GET | `agent-worker/status` | Get agent status |
| `/api/agent/prompts` | GET | `agent-worker/prompts` | List prompt templates |
| `/api/agent/risk-override` | POST | `agent-worker/risk-override` | Override risk settings |

---

## Sidebar Navigation

Update `nav-main.tsx` to add collapsible "Agent" section:

```tsx
{
  title: "Agent",
  icon: Brain,
  href: "/dashboard/agent",
  children: [
    { title: "Overview", href: "/dashboard/agent" },
    { title: "Chat", href: "/dashboard/agent/chat" },
    { title: "Vision", href: "/dashboard/agent/vision" },
    { title: "Reasoning", href: "/dashboard/agent/reasoning" },
    { title: "Models", href: "/dashboard/agent/models" },
    { title: "Risk", href: "/dashboard/agent/risk" },
    { title: "Usage", href: "/dashboard/agent/usage" },
  ]
}
```

---

## Data Flow

1. **Config reads:** Dashboard API route → `CONFIG_KV.get('agent:config')` → JSON parse → return
2. **Config writes:** Dashboard API route → `CONFIG_KV.put('agent:config', JSON.stringify(value))` → return success
3. **Chat streaming:** Dashboard API route → fetch `agent-worker/chat` → pipe SSE stream → client processes `data:` events
4. **Health checks:** Dashboard API route → fetch `agent-worker/health` → return provider status
5. **Risk overrides:** Dashboard API route → `CONFIG_KV.put('trade:kill_switch', value)` → return success

---

## Component Usage (shadcn/ui)

Per project standards, all components use:
- **Semantic colors:** `bg-primary`, `text-muted-foreground` (no raw color values)
- **Spacing:** `gap-*` not `space-y-*`
- **Icons:** Pass as objects `{Brain}` not string keys; no sizing classes on icons
- **Forms:** `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription`
- **Buttons with icons:** `data-icon="inline-start"` or `data-icon="inline-end"`
- **Equal dimensions:** `size-*` not `w-* h-*`
- **Conditional classes:** `cn()` not template literal ternaries

---

## Files to Create

### Pages
- `src/app/dashboard/agent/page.tsx` - Overview
- `src/app/dashboard/agent/chat/page.tsx` - Chat
- `src/app/dashboard/agent/vision/page.tsx` - Vision
- `src/app/dashboard/agent/reasoning/page.tsx` - Reasoning
- `src/app/dashboard/agent/models/page.tsx` - Models
- `src/app/dashboard/agent/risk/page.tsx` - Risk
- `src/app/dashboard/agent/usage/page.tsx` - Usage
- `src/app/dashboard/agent/metadata.ts` - Shared metadata

### API Routes
- `src/app/api/agent/config/route.ts` - GET/POST config
- `src/app/api/agent/chat/route.ts` - POST chat with SSE
- `src/app/api/agent/models/route.ts` - GET models
- `src/app/api/agent/test-model/route.ts` - POST test-model
- `src/app/api/agent/vision/route.ts` - POST vision
- `src/app/api/agent/reasoning/route.ts` - POST reasoning
- `src/app/api/agent/usage/route.ts` - GET usage
- `src/app/api/agent/health/route.ts` - GET health
- `src/app/api/agent/status/route.ts` - GET status
- `src/app/api/agent/prompts/route.ts` - GET prompts
- `src/app/api/agent/risk-override/route.ts` - POST risk-override

### Components
- `src/components/agent/overview.tsx` - Overview cards
- `src/components/agent/chat-interface.tsx` - Chat UI + SSE
- `src/components/agent/vision-upload.tsx` - Image upload + preview
- `src/components/agent/reasoning-panel.tsx` - Reasoning UI + tabs
- `src/components/agent/model-config.tsx` - Provider config form
- `src/components/agent/health-check.tsx` - Health status table
- `src/components/agent/test-model.tsx` - Model testing form
- `src/components/agent/risk-parameters.tsx` - Risk sliders + switches
- `src/components/agent/trailing-stops.tsx` - Trailing stops table
- `src/components/agent/usage-chart.tsx` - Usage AreaChart
- `src/components/agent/usage-table.tsx` - Provider breakdown table
- `src/components/agent/kill-switch.tsx` - Kill switch alert + button

### Updated Files
- `src/components/dashboard/nav-main.tsx` - Add Agent section
- `src/components/dashboard/workers-overview.tsx` - Wire up real agent data

---

## Success Criteria

1. ✅ All 7 pages accessible via sidebar navigation
2. ✅ Chat page streams responses via SSE
3. ✅ Vision page accepts image upload and displays analysis
4. ✅ Reasoning page shows thinking process and answer in tabs
5. ✅ Models page can configure providers and test models
6. ✅ Risk page can adjust parameters and toggle kill switch
7. ✅ Usage page displays charts and provider breakdown
8. ✅ All API routes proxy correctly to agent-worker
9. ✅ All components follow shadcn/ui standards
10. ✅ Mobile responsive (Next.js 16 + Tailwind v4)
