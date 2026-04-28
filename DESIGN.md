# Hoox Trading System - Product & Technical Design

This document serves as the Single Source of Truth for the Hoox Trading System. It outlines the product overview, technical architecture, data models, workflows, UI/UX guidelines, and explicit instructions for AI agents modifying the codebase.

## 1. Product Overview & Goal

Hoox is a 100% free, open-source, Zero Latency, Edge-executed trading system. It operates as a Gateway and Execution Engine that ingests trading signals (via TradingView webhooks, emails, or Telegram), validates them using Cloudflare's WAF and Zero Trust architecture, and executes trades across multiple exchanges (Binance, MEXC, Bybit) using smart placement. It features an autonomous AI Risk Manager that monitors portfolios 24/7.

## 2. System Architecture & Workflows

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INPUTS                                  │
│         TradingView Webhooks │ Email (IMAP) │ Telegram │ API           │
└─────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare WAF                                    │
│  ┌─────────────┐  ┌─────────────┐                                           │
│  │ IP Allowlist│  │ Rate Limits │                                           │
│  └─────────────┘  └─────────────┘                                           │
└─────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           hoox (Gateway)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Kill Switch │  │ Session Mgr │  │ Idempotency │  │ Trade Router│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────┬─────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │ Fast Path (Direct Bind)   │ Fallback (Queue)
                    ▼                           ▼
┌─────────────────────────────┐  ┌─────────────────────────────────────────────┐
│    trade-worker (Execution)   │  │      telegram-worker (Notifications)        │
│  ┌─────────┐ ┌─────────────┐ │  │  ┌─────────────┐ ┌─────────────────────┐  │
│  │Binance │ │  MEXC Client │ │  │  │Telegram Bot │ │  AI Summarizer       │  │
│  │Client  │ │Bybit Client │ │  │  │             │  │                     │  │
│  └─────────┘ └─────────────┘ │  │  └─────────────┘ └─────────────────────┘  │
└──────────────┬──────────────┘  └───────────────────┬────────────────────┘
               │                                       │
               │          ┌─────────────┬────────────┘
               │          │             │
               ▼          ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      d1-worker (Data Layer) & R2 Storage              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              D1 Database (SQLite)                           │   │
│  │  trade_signals │ trades │ positions │ balances             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              R2 Object Storage                              │   │
│  │  hoox-system-logs │ trade-reports                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
                          ┌────────┴────────┐
                          │                 │
                          ▼                 ▼
┌────────────────────────────────────┐  ┌────────────────────────────────────┐
│   agent-worker (AI Agent)          │  │       dashboard (UI)           │
│   Runs every 5 minutes             │  │       Next.js + React               │
│   - Portfolio monitoring          │  │       - Overview / Trades           │
│   - Risk management               │  │       - Positions / Settings        │
│   - Autonomous decisions          │  │       - Logs / Charts               │
└────────────────────────────────────┘  └────────────────────────────────────┘
```

### 2.2 Workers List

| Worker | Path | Purpose | Cron |
|--------|------|---------|------|
| **hoox** | `workers/hoox/` | Gateway/firewall for webhooks | - |
| **trade-worker** | `workers/trade-worker/` | Multi-exchange execution | - |
| **agent-worker** | `workers/agent-worker/` | AI risk manager | `*/5 * * * *` |
| **dashboard** | `workers/dashboard/` | React dashboard | - |
| **telegram-worker** | `workers/telegram-worker/` | Notifications | - |
| **d1-worker** | `workers/d1-worker/` | D1 database ops | - |
| **web3-wallet-worker** | `workers/web3-wallet-worker/` | DeFi/on-chain | - |
| **email-worker** | `workers/email-worker/` | Email signal scanner | `*/5 * * * *` |


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

- **Edge Compatibility**: Always prioritize Edge compatibility (Cloudflare Workers). Avoid Node.js built-ins where possible or polyfill appropriately if strictly necessary.
- **Zero Trust**: Ensure Zero Trust bindings for secrets. Never hardcode secrets. Always use `wrangler secret` mechanisms and service bindings.
- **Package Management**: Use `bun` for all package management, testing (`bun test`), and script execution (`bun run`).
- **Strict Typing**: The system enforces strict typing for all configuration files via the `WranglerConfig` and `Config` interfaces. Avoid using `as any`.
- **Durable Objects & Queues**: Leverage Durable Objects for idempotency and queues for failover and heavy processing tasks.
