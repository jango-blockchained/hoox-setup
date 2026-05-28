# Hoox Trading System — Product & Technical Design

This document serves as the Single Source of Truth for the Hoox Trading System. It outlines the product overview, technical architecture, data models, workflows, UI/UX guidelines, and explicit instructions for AI agents modifying the codebase. All project context lives in `.opencode/context/project-intelligence/`.

> **See [AGENTS.md](AGENTS.md) for AI agent setup instructions, project structure, commands, CI pipeline, testing modes, and local development workflows.**

## 1. Product Overview & Goal

Hoox is a 100% free, open-source, Zero Latency, Edge-executed trading system. It operates as a Gateway and Execution Engine that ingests trading signals (via TradingView webhooks, emails, or Telegram), validates them using Cloudflare's WAF and Zero Trust architecture, and executes trades across multiple exchanges (Binance, MEXC, Bybit) using smart placement. It features an autonomous AI Risk Manager that monitors portfolios 24/7.

The system runs **10 Cloudflare Workers** across dedicated services: gateway, trade execution, AI agent, D1 data access, notifications, email parsing, on-chain execution, analytics, PDF reporting, and the Next.js dashboard. All project intelligence, plans, specs, and conventions are maintained in `.opencode/` — the central knowledge hub for AI agents.

## 2. System Architecture & Workflows

### 2.1 System Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CLI Management Plane (hoox commands)                                         │
│   init │ clone │ dev │ deploy │ infra │ config (env+kv) │ check │ db │ monitor │ repair │ logs │ test │ waf     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                   │
│ ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                                          EXTERNAL INPUTS                                                     │ │
│ │              TradingView Webhooks │ Email (IMAP) │ Telegram │ API                                           │ │
│ └───────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┘ │
│                                                      │                                                           │
│                                                      ▼                                                           │
│ ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                                            Cloudflare WAF                                                     │ │
│ │                                     ┌──────────────┐ ┌──────────────┐                                         │ │
│ │                                     │  IP Allowlist │ │  Rate Limits  │                                         │ │
│ │                                     └──────────────┘ └──────────────┘                                         │ │
│ └───────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┘ │
│                                                      │                                                           │
│                                                      ▼                                                           │
│ ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                                           hoox (Gateway)                                                       │ │
│ │      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │ │
│ │      │  Kill Switch  │ │  Session Mgr │ │  Idempotency │ │ Trade Router │ │ Queue (bkup) │                    │ │
│ │      └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘                    │ │
│ └─────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                                                          │
│                            ┌───────────┴────────────────┐                                                        │
│                            │                            │                                                        │
│                            ▼                            ▼                                                        │
│ ┌──────────────────────────────────┐  ┌──────────────────────────────────────────────────────────────────────┐   │
│ │      trade-worker (Execution)     │  │      telegram-worker (Notifications)                                  │   │
│ │  ┌──────────┐ ┌──────────┐      │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                   │   │
│ │  │  Binance  │ │   MEXC   │      │  │  │ Telegram Bot  │ │ AI Summarizer│ │   Notify     │                   │   │
│ │  │  Client   │ │  Client  │      │  │  └──────────────┘ └──────────────┘ └──────────────┘                   │   │
│ │  │  Bybit    │ │          │      │  └────────────────────────┬──────────────────────────────────────────────┘   │
│ │  │  Client   │ │          │      │                           │                                                 │
│ │  └──────────┘ └──────────┘      │                           │                                                 │
│ └─────────────────┬────────────────┘                           │                                                 │
│                   │                    ┌───────────────────────┘                                                 │
│                   ▼                    ▼                                                                         │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                       d1-worker (Data Layer) & R2 Storage                                                   │ │
│ │                  ┌────────────────────────────────────────────────────────┐                                  │ │
│ │                  │           D1 Database (SQLite)                          │                                  │ │
│ │                  │  trade_signals │ trades │ positions │ balances         │                                  │ │
│ │                  └────────────────────────────────────────────────────────┘                                  │ │
│ │                  ┌────────────────────────────────────────────────────────┐                                  │ │
│ │                  │         R2 Object Storage                               │                                  │ │
│ │                  │  hoox-system-logs │ trade-reports                      │                                  │ │
│ │                  └────────────────────────────────────────────────────────┘                                  │ │
│ └────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────┘ │
│                                       ▲                                    ▲                                     │
│                                       │                                    │                                     │
│                         ┌─────────────┴──────┐              ┌──────────────┴──────┐                              │
│                         │                    │              │                     │                              │
│                         ▼                    ▼              ▼                     ▼                              │
│ ┌──────────────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐ ┌────────────────────────────┐  │
│ │    agent-worker (AI Agent)    │ │    report-worker     │ │   dashboard         │ │  Docs Site (pages/docs)   │  │
│ │    Runs */5 * * * *           │ │    PDF Reports       │ │   workers/dashboard │ │  Astro-based docs site    │  │
│ │    - Portfolio monitoring    │ │    via Browser Rend. │ │   Next.js 16        │ │                           │  │
│ │    - Risk management         │ │    Cron 06:00+18:00  │ │   OpenNext/CF       │ │                           │  │
│ │    - Autonomous decisions    │ │    ➜ R2 + Telegram    │ │   ➜ D1 + Agent      │ │                           │  │
│ └──────────────────────────────┘ └──────────────────────┘ └────────────────────┘ └────────────────────────────┘  │
│                                                                                                                   │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                    analytics-worker (Observability & Time-Series)                                             │ │
│ │    Service bindings from: hoox │ trade-worker │ d1-worker │ telegram │ email │ web3-wallet                    │ │
│ │    Stores to: Analytics Engine (hoox-analytics dataset) — Connected to all system components                    │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Workers List

| Worker                 | Path                          | Purpose                            | Cron             |
| ---------------------- | ----------------------------- | ---------------------------------- | ---------------- |
| **hoox**               | `workers/hoox/`               | Gateway/firewall for webhooks      | -                |
| **trade-worker**       | `workers/trade-worker/`       | Multi-exchange execution           | -                |
| **agent-worker**       | `workers/agent-worker/`       | AI risk manager                    | `*/5 * * * *`    |
| **dashboard**          | `workers/dashboard/`          | Next.js dashboard                  | -                |
| **telegram-worker**    | `workers/telegram-worker/`    | Notifications                      | -                |
| **d1-worker**          | `workers/d1-worker/`          | D1 database ops                    | -                |
| **web3-wallet-worker** | `workers/web3-wallet-worker/` | DeFi/on-chain execution            | -                |
| **email-worker**       | `workers/email-worker/`       | Email signal scanner               | `*/5 * * * *`    |
| **analytics-worker**   | `workers/analytics-worker/`   | Analytics Engine tracking          | -                |
| **report-worker**      | `workers/report-worker/`      | PDF reports via Browser Rendering  | `0 8 * * *`      |
|                       |                               |                                    | `0 18 * * *`     |

### 2.3 Communication Pattern

Internal workers communicate via **Cloudflare Service Bindings** (not public URLs). The Hoox Gateway is the only user-facing entry point. The Dashboard has its own public URL but uses service bindings to reach internal workers.

## 3. Data Models (D1 & R2)

```sql
-- Incoming signals from TradingView/Email
CREATE TABLE trade_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,           -- 'tradingview' | 'email' | 'telegram'
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,            -- 'buy' | 'sell'
    price REAL,
    quantity REAL,
    leverage INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',   -- 'pending' | 'executed' | 'failed' | 'skipped'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    executed_at TEXT,
    error TEXT
);

-- Executed trades
CREATE TABLE trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER REFERENCES trade_signals(id),
    exchange TEXT NOT NULL,          -- 'binance' | 'mexc' | 'bybit'
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    price REAL NOT NULL,
    quantity REAL NOT NULL,
    leverage INTEGER DEFAULT 1,
    pnl REAL,                       -- Profit/loss in quote currency
    pnl_percent REAL,
    status TEXT DEFAULT 'open',      -- 'open' | 'closed'
    opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT,
    order_id TEXT,
    raw_response TEXT
);

-- Active positions
CREATE TABLE positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER REFERENCES trades(id),
    exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,              -- 'long' | 'short'
    entry_price REAL NOT NULL,
    current_price REAL,
    quantity REAL NOT NULL,
    leverage INTEGER DEFAULT 1,
    unrealized_pnl REAL DEFAULT 0,
    liquidation_price REAL,
    status TEXT DEFAULT 'open',
    opened_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Exchange balance snapshots
CREATE TABLE balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exchange TEXT NOT NULL,
    asset TEXT NOT NULL,
    free REAL NOT NULL,
    locked REAL NOT NULL,
    total REAL NOT NULL,
    snapshot_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- System observability
CREATE TABLE system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,              -- 'INFO' | 'WARN' | 'ERROR'
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 4. UI/UX & Aesthetic Rules (Dashboard)

This ruleset governs the aesthetic, layout, and UX patterns for the Hoox Dashboard to maintain a consistent, high-quality, and modern command-center feel.

- **Theme**: Dark mode by default, utilizing deep neutrals (`bg-black`, `bg-neutral-950`, `bg-neutral-900`).
- **Brand Colors**: Monochromatic black/white (Zinc) for primary actions, highlights, and primary icons.
- **Secondary Colors**: Muted neutrals (`text-muted-foreground`) for secondary information.
- **Textures**: Use ambient background glows (large blurs), subtle noise overlays (`mix-blend-overlay`), and grid patterns to add depth without distracting from content.
- **Cards**: Utilize `shadcn/ui` Card components with elevated styling: `border-border bg-card backdrop-blur-xl shadow-2xl`.
- **Card Headers**: Use clear separation, often with a subtle border at the top of the card or between the header and content.
- **Density**: Keep information dense but readable. Use flexboxes with `gap-4` or `gap-6` for consistent spacing.
- **Labels**: Use small, uppercase, and tracked-out text for labels and subheadings (`text-xs uppercase tracking-wider text-muted-foreground font-semibold`).
- **Titles**: Use robust fonts for primary headers.
- **Monospace**: Use monospace fonts (`font-mono`) for technical data, IDs, code snippets, and security footers.
- **Buttons**: Primary buttons should use `bg-primary hover:bg-primary/90 text-primary-foreground` with subtle shadows.
- **Inputs**: Use subtle focus rings (`focus-visible:border-primary/50 focus-visible:ring-primary/20`) and standard backgrounds.
- **Badges**: Use highly contrasting badges for status (e.g., `bg-primary` for active/synced, `muted-foreground` for disabled).
- **Framer Motion**: Wrap major layout shifts and card entrances in `motion.div`. Use `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}` for smooth loading.
- **Icons**: Use spring-based scaling for primary icons on load (`type: "spring", stiffness: 200`).
- **Loaders**: Replace static loading text with spinning icons (`Loader2` from `lucide-react`) alongside the text.
- **Security & Trust**: Always communicate security clearly (e.g., "Secured by Zero Trust Architecture"). Use icons (`Shield`, `Lock`) to reinforce secure contexts. Error states should be explicitly styled with destructive colors (`border-destructive/50`, `text-destructive`) and include an icon for immediate recognition.

## 5. AI Agent Rules & Project Conventions

- **Edge Compatibility**: All workers run on Cloudflare Workers Edge with `nodejs_compat` flag. Avoid Node.js built-ins where possible or polyfill appropriately. Dashboard uses OpenNext runtime for full Node.js support (separate from Edge workers).
- **Zero Trust**: Ensure Zero Trust bindings for secrets. Never hardcode secrets. Always use `wrangler secret` mechanisms and service bindings.
- **Package Management**: Use `bun` for all package management, testing (`bun test`), and script execution (`bun run`).
- **Strict Typing**: The system enforces strict typing for all configuration files via the `WranglerConfig` and `Config` interfaces. Avoid using `as any`.
- **Durable Objects & Queues**: Leverage Durable Objects for idempotency and queues for failover and heavy processing tasks.
- **Project Knowledge**: All project context lives in `.opencode/context/project-intelligence/`. Plans in `.opencode/plans/`, specs in `.opencode/specs/`, skills in `.opencode/skills/`.

## 6. Dashboard & Next.js Build Process

### 6.1 Dashboard Overview

The dashboard lives at `workers/dashboard/` and is a Next.js 16 application deployed to **Cloudflare Workers** (not Pages) via the OpenNext Cloudflare adapter.

**Architecture:**
- Next.js 16 with Turbopack for development
- `@opennextjs/cloudflare` adapter for Workers deployment
- Service bindings to `d1-worker` and `agent-worker` (not public URLs)
- KV bindings: `CONFIG_KV`, `NEXT_INC_CACHE_KV`
- Node.js runtime via OpenNext adapter (full Next.js feature support)
- Static assets served via `ASSETS` binding from `.open-next/assets/`
- Framer Motion components require `'use client'` directive at file top
- Pages with `'use client'` cannot export `metadata` — use separate `metadata.ts`

### 6.2 Next.js 16 + Turbopack on Cloudflare Edge

#### 6.2.1 Monorepo Structure Issues

When using Next.js 16+ in a monorepo with Turbopack, several known issues can occur:

**Problem**: Turbopack infers wrong project root

```
Error: Next.js inferred your workspace root, but it may not be correct.
We couldn't find the Next.js package (next/package.json) from the project directory: /path/to/project/src/app
```

**Root Causes**:
1. **Nested `node_modules`**: A duplicate `next` installation in `src/app/node_modules` causes type conflicts
2. **Duplicate config files**: `next.config.ts` in both root and `src/` directory
3. **Turbopack root detection**: Turbopack looks for lock files to determine project root

**Solutions**:

Next.js 16 automatically infers the correct project root in most cases. No manual root configuration needed:

```typescript
// next.config.ts — minimal config for Next.js 16 + OpenNext
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
```

#### 6.2.2 Edge Runtime & Framer Motion

**Problem**: `createMotionComponent() from the server but is on the client`

**Solution**: Add `'use client'` directive to all pages using framer-motion:

```tsx
"use client";

import { motion } from "framer-motion";
// ... rest of component
```

**Note**: Pages with `'use client'` cannot export `metadata`. Move metadata to separate `metadata.ts` file.

#### 6.2.3 Middleware (Next.js 16 + OpenNext)

Next.js 16 with OpenNext Cloudflare requires `middleware.ts` (not `proxy.ts`):

```typescript
// middleware.ts — Next.js 16 middleware for OpenNext Cloudflare
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Export as 'middleware' for OpenNext Cloudflare compatibility
export function middleware(request: NextRequest) {
  // ... middleware logic
}
```

#### 6.2.4 TypeScript Configuration

**Common errors**:
1. `RouteHandlerConfig` type mismatches — ensure route handlers accept `context: { params: Promise<{}> }`
2. Nested `node_modules` causing duplicate type definitions — remove any `node_modules` inside `src/`
3. Use `as unknown as Type` for complex type assertions when needed

#### 6.2.5 Build Commands

```bash
# Always use bun in this project
bun run build    # Uses next build with Turbopack
bun run dev      # Development with Turbopack

# Type checking
bunx tsc --noEmit

# Clear caches if build issues persist
rm -rf .next && rm -rf .next/cache
```

#### 6.2.6 Cloudflare Workers Deployment (OpenNext)

Dashboard deploys to **Cloudflare Workers** (not Pages) using OpenNext Cloudflare adapter:

**Build & Deploy:**

```bash
# Build with OpenNext (outputs to .open-next/)
bunx opennextjs-cloudflare build

# Deploy to Cloudflare Workers (NOT Pages!)
bunx wrangler deploy
```

**Configuration (`workers/dashboard/wrangler.jsonc`):**

```jsonc
{
  "name": "dashboard",
  "main": ".open-next/worker.js",
  "account_id": "your_account_id",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS",
  },
  "services": [
    { "binding": "D1_SERVICE", "service": "d1-worker" },
    { "binding": "AGENT_SERVICE", "service": "agent-worker" },
  ],
}
```

**Key Points:**
- **Workers, NOT Pages**: OpenNext with Cloudflare deploys to Workers for full Next.js feature support
- **Node.js Runtime**: Via OpenNext adapter (supports all Next.js features)
- **Static Assets**: Served via `ASSETS` binding from `.open-next/assets/`
- **Environment Variables**: Set via `wrangler secret` or `.dev.vars`

**Why Workers over Pages?**
- Full Node.js runtime support (not just Edge)
- Better Next.js feature compatibility (App Router, SSR, ISR, API routes)
- More flexible binding support (KV, D1, Durable Objects)

## 7. Context File Organization

All project intelligence for AI agents is maintained in `.opencode/`:

```
.opencode/
├── context/project-intelligence/   — Architecture, tech-stack, CLI commands/services,
│                                      worker examples, endpoints, bindings, errors
│   ├── navigation.md               — File index and lookup guide
│   ├── concepts/                   — Architecture concepts
│   ├── errors/                     — Error handling patterns
│   ├── examples/                   — Usage examples
│   ├── guides/                     — How-to guides
│   └── lookup/                     — Quick reference files
├── plans/                          — Implementation plans (19)
├── specs/                          — Design documents (7)
├── tasks.md                        — Active 4-phase refactoring plan
├── tasks/                          — Task breakdown JSONs
├── sessions/                       — Session context files (3)
├── external-context/               — Fetched external documentation
├── skills/                         — Project-specific skills (shadcn, nextjs-build, task-management)
├── brainstorms/                    — Brainstorm session records
└── analysis/                       — Code analysis reports
```

## 8. CLI Architecture

The `hoox` CLI (`packages/cli/`) is built with **commander.js** and provides 15 command groups:

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `init`              | Bootstrap new Hoox project                       |
| `clone`             | Clone existing configuration                     |
| `dev`               | Start local development environment              |
| `deploy`            | Deploy workers to Cloudflare                     |
| `infra`             | Infrastructure management (R2, KV, D1, Queues)   |
| `config env`        | Environment variable management                  |
| `config kv`         | KV namespace operations                          |
| `check`             | Prerequisites and system checks                  |
| `db`                | Database operations (migrate, seed, inspect)     |
| `monitor`           | Real-time system monitoring                      |
| `repair`            | Repair and recovery operations                   |
| `logs`              | Log streaming and querying                       |
| `test`              | Run test suites                                  |
| `waf`               | WAF rule management                              |
| `dashboard`         | Dashboard dev server and management              |

**Key services** (in `packages/cli/src/services/`):
- `CloudflareService` — API interactions, worker uploads, KV operations
- `DbService` — D1 migrations and queries
- `ConfigService` — Environment and configuration management
- `SecretsService` — Secret store interactions
- `DockerService` — Docker Compose runtime management

**Testing:** 381+ unit tests across all services and commands. Run with `bun test`.

## 9. Infrastructure Bindings

| Service              | Binding            | Workers                                          |
| -------------------- | ------------------ | ------------------------------------------------ |
| D1 `trade-data-db`   | DB                 | d1-worker, trade-worker                          |
| R2 `trade-reports`   | REPORTS_BUCKET     | trade-worker, report-worker                      |
| R2 `hoox-system-logs`| SYSTEM_LOGS_BUCKET | trade-worker                                     |
| R2 `user-uploads`    | UPLOADS_BUCKET     | telegram-worker                                  |
| KV `CONFIG_KV`       | CONFIG_KV          | hoox, d1-worker, trade-worker, agent-worker,     |
|                      |                    | telegram-worker, email-worker, dashboard         |
| KV `SESSIONS_KV`     | SESSIONS_KV        | hoox                                             |
| KV `NEXT_INC_CACHE_KV`| NEXT_INC_CACHE_KV | dashboard                                        |
| Vectorize `my-rag-index` | VECTORIZE_INDEX | hoox, telegram-worker                            |
| Queue `trade-execution` | TRADE_QUEUE      | hoox (producer), trade-worker (consumer)         |
| Analytics Engine     | ANALYTICS_ENGINE   | analytics-worker                                 |
| AI                   | AI                 | hoox, agent-worker, telegram-worker              |
| Browser Rendering    | —                  | report-worker                                    |
| Durable Objects      | IDEMPOTENCY_STORE  | hoox                                             |

## 10. Service Binding Map

The complete service binding mesh for inter-worker communication:

```
hoox           → trade-worker, telegram-worker, analytics-worker
trade-worker   → d1-worker, telegram-worker, analytics-worker
agent-worker   → d1-worker, trade-worker, telegram-worker
d1-worker      → analytics-worker
telegram-worker → analytics-worker
email-worker   → trade-worker, analytics-worker
report-worker  → telegram-worker
dashboard      → d1-worker, agent-worker
web3-wallet-worker → telegram-worker, analytics-worker
```

## 11. Code Graph (AI/LLM Context)

The repository includes a machine-readable code graph for AI/LLM consumption:

- **`graph-metadata.json`** (44KB) — Load fully into context. Human-authored semantic descriptions for workers, infrastructure, data flows, and communities.
- **`graph.json`** (2.5MB) — Query/search with `bun`, `jq`, or `grep`. Contains nodes (types, functions, classes, workers, infrastructure) and edges (imports, calls, service bindings, data flows). Each worker node includes `llmContext` with natural language descriptions.
- **`graph.dot`** (1.3MB) — Render-only with Graphviz (`dot -Tsvg graph.dot -o graph.svg`). Not for agent consumption.

**Regenerate:**

```bash
bun run graph    # Runs scripts/extract-graph.ts (~25s)
```

**Agent query patterns:**
```bash
# Get a worker's llmContext
bun -e "console.log(require('./graph.json').nodes.find(n=>n.id==='workspace:workers/hoox').llmContext)"

# List all workers with entry points
bun -e "require('./graph.json').nodes.filter(n=>n.kind==='worker').forEach(w=>console.log(w.label,'→',w.entryPoint))"

# Find data flows from a worker
bun -e "const g=require('./graph.json'); g.edges.filter(e=>e.source==='workspace:workers/hoox'&&e.kind==='data-flow').forEach(e=>console.log(e.description))"
```

The graph has three layers:
1. **Code layer** — TypeScript exports, imports, calls, references (auto-extracted from AST)
2. **Architecture layer** — Worker nodes with descriptions, infrastructure nodes (D1, R2, KV, Queue, DO, AI, Vectorize, Analytics Engine, Browser Rendering), service binding edges, data flow edges
3. **Community groups** — Logical clusters: workers, packages, infrastructure, signal-pipeline, ai-system
