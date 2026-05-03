# Agent Worker Dashboard Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully integrate the agent-worker (AI & Risk Manager) into the Next.js 16 dashboard with dedicated pages for chat, vision, reasoning, model configuration, risk management, and usage statistics.

**Architecture:** Dashboard pages proxy requests to agent-worker endpoints via Next.js API routes using `getCloudflareContext().env` for KV/Service Bindings access. SSE streaming for chat. shadcn/ui components throughout per project standards.

**Tech Stack:** Next.js 16 (App Router, Edge Runtime), TypeScript, Tailwind v4, shadcn/ui (radix base, New York style, lucide icons), framer-motion, @opennextjs/cloudflare

---

## Task List

1. **[01-sidebar-navigation.md](./01-sidebar-navigation.md)** - Update sidebar with Agent section
2. **[02-metadata.md](./02-metadata.md)** - Create shared metadata file
3. **[03-api-routes-config-health-status.md](./03-api-routes-config-health-status.md)** - API routes: config, health, status
4. **[04-api-routes-models-test.md](./04-api-routes-models-test.md)** - API routes: models, test-model
5. **[05-api-routes-chat-vision-reasoning.md](./05-api-routes-chat-vision-reasoning.md)** - API routes: chat (SSE), vision, reasoning
6. **[06-api-routes-usage-prompts-risk.md](./06-api-routes-usage-prompts-risk.md)** - API routes: usage, prompts, risk-override
7. **[07-overview-page.md](./07-overview-page.md)** - Overview page
8. **[08-chat-page.md](./08-chat-page.md)** - Chat page with SSE streaming
9. **[09-vision-page.md](./09-vision-page.md)** - Vision analysis page
10. **[10-reasoning-page.md](./10-reasoning-page.md)** - Reasoning page with tabs
11. **[11-models-page.md](./11-models-page.md)** - Models page with tabs
12. **[12-risk-page.md](./12-risk-page.md)** - Risk management page
13. **[13-usage-page.md](./13-usage-page.md)** - Usage statistics page
14. **[14-components.md](./14-components.md)** - Shared agent components
15. **[15-workers-overview-update.md](./15-workers-overview-update.md)** - Update workers overview with real data

---

## File Structure

### Pages
- `src/app/dashboard/agent/metadata.ts`
- `src/app/dashboard/agent/page.tsx`
- `src/app/dashboard/agent/chat/page.tsx`
- `src/app/dashboard/agent/vision/page.tsx`
- `src/app/dashboard/agent/reasoning/page.tsx`
- `src/app/dashboard/agent/models/page.tsx`
- `src/app/dashboard/agent/risk/page.tsx`
- `src/app/dashboard/agent/usage/page.tsx`

### API Routes
- `src/app/api/agent/config/route.ts`
- `src/app/api/agent/health/route.ts`
- `src/app/api/agent/status/route.ts`
- `src/app/api/agent/models/route.ts`
- `src/app/api/agent/test-model/route.ts`
- `src/app/api/agent/chat/route.ts`
- `src/app/api/agent/vision/route.ts`
- `src/app/api/agent/reasoning/route.ts`
- `src/app/api/agent/usage/route.ts`
- `src/app/api/agent/prompts/route.ts`
- `src/app/api/agent/risk-override/route.ts`

### Components
- `src/components/agent/overview.tsx`
- `src/components/agent/chat-interface.tsx`
- `src/components/agent/vision-upload.tsx`
- `src/components/agent/reasoning-panel.tsx`
- `src/components/agent/model-config.tsx`
- `src/components/agent/health-check.tsx`
- `src/components/agent/test-model.tsx`
- `src/components/agent/risk-parameters.tsx`
- `src/components/agent/trailing-stops.tsx`
- `src/components/agent/usage-chart.tsx`
- `src/components/agent/usage-table.tsx`
- `src/components/agent/kill-switch.tsx`

### Updated Files
- `src/components/dashboard/nav-main.tsx`
- `src/components/dashboard/workers-overview.tsx`
