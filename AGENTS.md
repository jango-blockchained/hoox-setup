# Hoox Trading System - Agent Documentation

This document provides comprehensive documentation of the Hoox trading system architecture, tech stack, security, and development workflows. It serves as the primary reference for AI agents and developers working on this project.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Worker Reference](#3-worker-reference)
4. [Database Schema](#4-database-schema)
5. [Security](#5-security)
6. [Wizard & CLI](#6-wizard--cli)
7. [Development](#7-development)
8. [Housekeeping System](#8-housekeeping-system)

---

## 1. Architecture Overview

### 1.1 System Diagram

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

### 1.2 Data Flow

| Step | Source | Destination | Description |
|------|--------|-------------|-------------|
| 1 | TradingView/Email | WAF/hoox | Webhook received and WAF rules applied |
| 2 | hoox | Idempotency DO | Prevent duplicate signals |
| 3 | hoox | kill switch | Check trading enabled in KV |
| 4 | hoox | trade-worker | Fast path direct execution (fallback to Queue) |
| 5 | trade-worker | exchange API | Execute trade via Smart Placement |
| 6 | trade-worker | d1-worker / R2 | Log trade data to D1, verbose logs to R2 |
| 7 | trade-worker | telegram-worker | Send notification |
| 8 | d1-worker | D1 | Persist data |
| 9 | dashboard | d1-worker | Read for UI |
| 10 | agent-worker | d1-worker | Analyze + autonomous actions |

### 1.3 Workers List

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
| **home-assistant-worker** | `workers/home-assistant-worker/` | Home automation | - |

### 1.4 Why Hoox?

- **100% Free & Open Source**: Leverages Cloudflare's generous free tiers
- **Zero Latency**: Code runs on Edge, milliseconds from exchange APIs
- **Superior Security**: Zero Trust architecture, IP allowlisting, encrypted service bindings
- **Autonomous AI**: agent-worker monitors portfolio 24/7, manages trailing stops, sends AI summaries

### 1.5 Test Coverage

By worker (approximate line coverage):

| Worker | Coverage |
|--------|----------|
| email-worker | ~94% |
| web3-wallet-worker | ~78% |
| home-assistant-worker | ~76% |
| agent-worker | ~62% |
| trade-worker | ~57% |
| hoox | ~57% |
| d1-worker | ~52% |
| telegram-worker | ~45% |

### 1.4 Shared Infrastructure

| Service | ID | Purpose |
|---------|---|---------|
| D1 Database | `a682f084-594e-4bd8-be2d-40ea5f8cf42e` | Trade data |
| KV (Config) | `c5917667a21745e390ff969f32b1847d` | Dynamic config |
| KV (Sessions) | `ff70a58b492e45d79880a7a8213c745c` | Session storage |
| R2 (Reports) | `trade-reports` | Trade reports |
| R2 (Uploads) | `user-uploads` | User uploads |
| Vectorize | `my-rag-index` | AI embeddings |
| Queue | `trade-execution` | Trade execution queue |
| Durable Object | `IdempotencyStore` | Duplicate prevention |
| Account ID | `debc6545e63bea36be059cbc82d80ec8` | Cloudflare account |

---

## 2. Tech Stack

### 2.1 Core Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| **Bun** | 1.3.12 | JavaScript runtime |
| **TypeScript** | 5.9.3 | Type safety |
| **Wrangler** | 4.83.0 | Cloudflare CLI |

### 2.2 Backend (Workers)

| Worker | Framework | Key Dependencies |
|--------|-----------|-------------------|
| hoox | itty-router 5.x | Hono |
| trade-worker | Hono 4.x | binance-connector, bybit-api, ethers |
| agent-worker | Hono 4.x | Cloudflare AI |
| d1-worker | Hono 4.x | - |
| telegram-worker | Hono 4.x | Telegram Bot API |
| email-worker | Hono 4.x | imap, imap-simple |
| web3-wallet-worker | Hono 4.x | ethers, puppeteer |
| home-assistant-worker | Hono 4.x | - |

### 2.3 Frontend (Dashboard)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.2.0 | React framework |
| **React** | 19.2.4 | UI library |
| **Tailwind CSS** | 4.2.0 | Styling |
| **Radix UI** | latest | Headless components |
| **Recharts** | 2.15.0 | Charts |
| **Framer Motion** | 12.38.0 | Animations |
| **Zod** | 3.24.1 | Validation |
| **date-fns** | 4.1.0 | Date utilities |
| **Lucide React** | 0.564.0 | Icons |

### 2.4 Development Tools

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit testing |
| **ESLint** | Linting |
| **Prettier** | Formatting |
| **Docker** | Containerization |

### 2.5 Cloudflare Bindings

| Binding | Type | Workers Using |
|---------|------|----------------|
| `DB` | D1 | trade-worker, d1-worker, agent-worker |
| `CONFIG_KV` | KV | hoox, trade-worker, telegram-worker, agent-worker |
| `SESSIONS_KV` | KV | hoox |
| `REPORTS_BUCKET` | R2 | trade-worker, telegram-worker |
| `UPLOADS_BUCKET` | R2 | telegram-worker |
| `VECTORIZE_INDEX` | Vectorize | trade-worker, telegram-worker, hoox |
| `AI` | AI | trade-worker, telegram-worker, agent-worker, hoox |
| `BROWSER` | Browser | trade-worker, web3-wallet-worker |
| `TRADE_SERVICE` | Service | hoox, telegram-worker, email-worker |
| `TELEGRAM_SERVICE` | Service | hoox, trade-worker, agent-worker |
| `D1_SERVICE` | Service | agent-worker |
| `TRADE_QUEUE` | Queue | hoox (producer), trade-worker (consumer) |
| `IDEMPOTENCY_STORE` | Durable Object | hoox |

---

## 3. Worker Reference

### 3.1 hoox (Gateway)

**Purpose:** Central webhook endpoint and firewall

**Entry:** `workers/hoox/src/index.ts`

**Key Files:**
- `src/ipAllowlist.ts` - IP validation
- `src/killSwitch.ts` - Global trading pause
- `src/sessionManager.ts` - Session management
- `src/tradeService.ts` - Trade routing
- `src/idempotencyStore.ts` - Durable Object for duplicate prevention

**Routes:**
- `POST /webhook/tradingview` - TradingView signals
- `POST /webhook/email` - Email-derived signals
- `GET/POST /session/*` - Session management

**Features:**
- Queue Producer: Sends trades to `trade-execution` queue
- Queue Modes: `queue_failover` (default) or `queue_everywhere`
- Idempotency: Prevents duplicate trades via Durable Object
- Rate Limiting: 10 trades/minute (in-memory)

**KV Keys:**
- `webhooks:queue_mode` - Queue mode setting
- `webhooks:ip_check_enabled` - IP allowlist toggle

**Secrets:**
- `WEBHOOK_API_KEY_BINDING` - Webhook authentication

---

### 3.2 trade-worker (Execution Engine)

**Purpose:** Multi-exchange trade execution

**Entry:** `workers/trade-worker/src/index.ts`

**Key Files:**
- `src/binance-client.ts` - Binance API
- `src/mexc-client.ts` - MEXC API
- `src/bybit-client.ts` - Bybit API
- `src/db-logger.ts` - D1 logging
- `src/exchange-router.ts` - Exchange selection

**Features:**
- Queue Consumer: Consumes from `trade-execution` queue
- Retry Logic: 5 attempts with exponential backoff (0s, 30s, 1m, 5m, 15m)
- Dead Letter: Failed trades after max retries

**Supported Exchanges:**
- Binance (spot + futures)
- MEXC (spot + futures)
- Bybit (spot + futures)

**Secrets:**
- `BINANCE_API_KEY`
- `BINANCE_API_SECRET`
- `MEXC_API_KEY`
- `MEXC_API_SECRET`
- `BYBIT_API_KEY`
- `BYBIT_API_SECRET`
- `API_SERVICE_KEY`

**Environment Variables:**
- `DEFAULT_LEVERAGE` - Default position leverage
- `USE_TESTNET` - Use testnet (true/false)

---

### 3.3 agent-worker (AI Risk Manager)

**Purpose:** Autonomous portfolio monitoring

**Entry:** `workers/agent-worker/src/index.ts`

**Schedule:** `*/5 * * * *` (every 5 minutes)

**Key Features:**
- Portfolio analysis
- Risk assessment
- Autonomous trade recommendations
- Housekeeping checks

**Routes:**
- `GET /agent/health` - Health check
- `POST /agent/housekeeping` - Run housekeeping

**Secrets:**
- `AGENT_INTERNAL_KEY`

**Service Bindings:**
- `D1_SERVICE` - Database access
- `TRADE_SERVICE` - Execute trades
- `TELEGRAM_SERVICE` - Send alerts

---

### 3.4 dashboard (Command Center)

**Purpose:** React-based trading dashboard

**Entry:** `workers/dashboard/src/app/`

**Tech Stack:**
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Recharts

**Pages:**
- `/` - Overview (metrics, charts)
- `/dashboard/trades` - Trade history
- `/dashboard/positions` - Active positions
- `/dashboard/settings` - Configuration
- `/dashboard/logs` - System logs

**Authentication:**
- Cookie-based session (httpOnly, secure, sameSite)
- 24-hour expiry

**Environment Variables:**
- `DASHBOARD_USER`
- `DASHBOARD_PASS`
- `D1_WORKER_URL`

---

### 3.5 telegram-worker (Notifications)

**Purpose:** Telegram bot notifications

**Entry:** `workers/telegram-worker/src/index.ts`

**Key Features:**
- Trade execution alerts
- AI summaries (via Cloudflare AI)
- Error notifications

**Secrets:**
- `TELEGRAM_BOT_TOKEN`

**Environment Variables:**
- `DEFAULT_CHAT_ID`

---

### 3.6 d1-worker (Data Layer)

**Purpose:** D1 database operations

**Entry:** `workers/d1-worker/src/index.ts`

**Routes:**
- `POST /db/signals` - Insert signals
- `POST /db/trades` - Insert trades
- `GET /db/signals` - Query signals
- `GET /db/trades` - Query trades
- `GET /db/positions` - Query positions
- `GET /db/balances` - Query balances
- `GET /db/stats` - Aggregate statistics
- `GET /db/logs` - System logs

**Secrets:**
- `D1_INTERNAL_KEY`

---

### 3.7 email-worker (Signal Scanner)

**Purpose:** Email-based signal extraction

**Entry:** `workers/email-worker/src/index.ts`

**Schedule:** `*/5 * * * *` (every 5 minutes)

**Modes:**
- IMAP (polling email)
- Webhook (Mailgun)

**Secrets:**
- `MAILGUN_API_KEY`
- `EMAIL_HOST`
- `EMAIL_USER`
- `EMAIL_PASS`

**Environment Variables:**
- `USE_IMAP` - Enable IMAP polling
- `TRADE_WORKER_NAME`

---

### 3.8 web3-wallet-worker (On-Chain)

**Purpose:** DeFi and on-chain execution

**Entry:** `workers/web3-wallet-worker/src/index.ts`

**Key Features:**
- Mnemonic wallet management
- On-chain trade execution
- Puppeteer for web3 interactions

**Secrets:**
- `WALLET_MNEMONIC_SECRET`
- `WALLET_PK_SECRET`

**Service Bindings:**
- `TELEGRAM_SERVICE`

---

### 3.9 home-assistant-worker (Home Automation)

**Purpose:** Smart home integration

**Entry:** `workers/home-assistant-worker/src/index.ts`

**Features:**
- Trade-triggered home automations
- Price alert notifications

**Environment Variables:**
- `HA_SECURE_URL`
- `HA_TOKEN`

---

## 4. Database Schema

### 4.1 Tables

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

---

## 5. Security

### 5.1 Authentication Layers

| Layer | Method | Implementation |
|-------|--------|---------------|
| Dashboard | Cookie Session | httpOnly + secure + sameSite cookie |
| hoox | API Key | `apiKey` in payload + secret validation |
| hoox | IP Allowlist | Whitelisted IPs only |
| Service-to-Service | Internal Key | `X-Internal-Auth-Key` header |
| Email Webhooks | HMAC | Mailgun signature verification |

### 5.2 Secrets Management

All secrets stored in Cloudflare Secret Store:

```bash
# List secrets
wrangler secret:list

# Put a secret
wrangler secret put WEBHOOK_API_KEY --worker hoox
```

**Required Secrets by Worker:**

| Worker | Secrets |
|--------|----------|
| hoox | WEBHOOK_API_KEY_BINDING |
| trade-worker | API_SERVICE_KEY, BINANCE_API_KEY, BINANCE_API_SECRET, MEXC_API_KEY, MEXC_API_SECRET, BYBIT_API_KEY, BYBIT_API_SECRET |
| agent-worker | AGENT_INTERNAL_KEY |
| telegram-worker | TELEGRAM_BOT_TOKEN |
| d1-worker | D1_INTERNAL_KEY |
| email-worker | EMAIL_HOST, EMAIL_USER, EMAIL_PASS, MAILGUN_API_KEY |
| web3-wallet-worker | WALLET_MNEMONIC_SECRET, WALLET_PK_SECRET |

### 5.3 Kill Switch

Global trading pause stored in `CONFIG_KV`:

```javascript
// Enable
await CONFIG_KV.put('kill_switch', 'true');

// Disable
await CONFIG_KV.put('kill_switch', 'false');

// Check
const killSwitch = await CONFIG_KV.get('kill_switch');
```

---

## 6. Wizard & CLI

### 6.1 Interactive TUI

Launch the integrated Terminal UI for local process management:

```bash
./hoox-tui
# or
bun run dev
```

This runs all 8 workers simultaneously on your local machine with hot-reloading.

### 6.2 hoox CLI Commands

```bash
# Setup wizard (first time)
hoox init

# Clone worker repositories
hoox workers clone

# Setup workers (bindings, secrets, D1)
hoox workers setup

# Deploy all workers
hoox workers deploy

# Deploy single worker
hoox workers deploy hoox

# Dev server for worker
hoox workers dev hoox

# Check worker status
hoox workers status

# Run tests
hoox workers test

# Update internal URLs
hoox workers update-internal-urls

# Housekeeping check
hoox housekeeping
hoox housekeeping --verbose

# Secret management guide
hoox secrets guide

# Validate setup
hoox check-setup

# Update CF secrets
hoox secrets update-cf WEBHOOK_API_KEY hoox
```

### 6.3 Full Push (submodules + main repo)

Commits and pushes all submodules with retry logic, then updates the main repo:

```bash
# Usage with custom commit message
bash scripts/full-push.sh "Your commit message"

# Default commit message
bash scripts/full-push.sh

# Or via hoox CLI (if implemented)
hoox full-push
```

The procedure:
1. Iterates through each git submodule
2. For each submodule:
   - Checks for changes, commits if any
   - Pushes with retry up to 5 times on failure
3. After all submodules pushed:
   - Updates submodule pointers in main repo
   - Commits main repo changes
   - Pushes main repo with retry up to 5 times

### 6.4 Configuration Files

**workers.jsonc** - Main configuration (JSONC format):

```jsonc
{
  "global": {
    "cloudflare_api_token": "xxx",
    "cloudflare_account_id": "xxx",
    "cloudflare_secret_store_id": "xxx",
    "subdomain_prefix": "cryptolinx"
  },
  "workers": {
    "hoox": {
      "enabled": true,
      "path": "workers/hoox",
      "vars": {}
    },
    "trade-worker": {
      "enabled": true,
      "path": "workers/trade-worker",
      "secrets": ["API_SERVICE_KEY"]
    }
  }
}
```

**pages.jsonc** - Pages configuration:

```jsonc
{
  "global": {
    "cloudflare_api_token": "xxx",
    "cloudflare_account_id": "xxx",
    "subdomain_prefix": "cryptolinx"
  },
  "pages": {
    "dashboard": {
      "enabled": true,
      "path": "pages/dashboard",
      "project_name": "hoox-dashboard",
      "vars": {
        "D1_WORKER_URL": "https://d1-worker.cryptolinx.workers.dev"
      }
    }
  }
}
```

### 6.5 Development Commands

```bash
# Install dependencies
bun install

# Typecheck all
bun run typecheck
bun run build

# Run tests
bun test
bun test:watch

# Lint
bun run lint

# Format
bun run format

# Local dev (wrangler)
bunx wrangler dev --worker hoox

# Deploy worker
bunx wrangler deploy

# View logs
bunx wrangler tail
```

---

## 7. Development

### 7.1 Local Development

```bash
# Clone workers (if not present)
hoox workers clone

# Install dependencies
bun install

# Start dev server
hoox workers dev hoox
```

### 7.2 Adding a New Worker

1. Create worker in `workers/` directory
2. Add configuration to `workers.jsonc`
3. Run `hoox workers setup`
4. Add service bindings to consuming workers
5. Test locally with `hoox workers dev <name>`
6. Deploy with `hoox workers deploy <name>`

### 7.3 Testing

```bash
# Run all tests
bun test

# Run specific worker tests
bun test workers/trade-worker

# Watch mode
bun test:watch
```

---

## 8. Housekeeping System

### 8.1 Overview

The housekeeping system runs automated health checks on all workers:

- **CLI:** `hoox housekeeping`
- **Cron:** Every 5 minutes via agent-worker
- **API:** `POST /agent/housekeeping`

### 8.2 Checks Performed

| Check | Description |
|-------|-------------|
| Directory existence | Worker directory exists |
| wrangler config | Valid JSONC parsing |
| Required fields | name, compatibility_date set |
| Account ID | Matches global config |
| Secret bindings | All declared secrets present |
| Service bindings | All service bindings valid |
| D1 bindings | Database bindings configured |
| Source file | Entry point exists |

### 8.3 Housekeeping API

```bash
# Trigger via API
curl -X POST https://d1-worker.<subdomain>.workers.dev/agent/housekeeping \
  -H "X-Internal-Auth-Key: <key>"
```

---

## 9. API Reference

### 9.1 Standard Request Wrapper

All inter-worker communication uses a standardized envelope:

```json
{
  "requestId": "uuid-v4-string",
  "internalAuthKey": "secret-key",
  "payload": {
    "service-specific": "data"
  }
}
```

### 9.2 API Payloads

**Trade Worker (process trade):**
```json
{
  "exchange": "mexc",
  "action": "LONG",
  "symbol": "BTC_USDT",
  "quantity": 0.01
}
```

**Telegram Worker (send notification):**
```json
{
  "chatId": "123456789",
  "message": "Trade executed: LONG BTC_USDT",
  "parseMode": "HTML"
}
```

**D1 Worker (execute query):**
```json
{
  "query": "INSERT INTO system_logs (level, message) VALUES (?, ?)",
  "params": ["INFO", "Trade executed"]
}
```

### 9.3 Endpoints by Worker

| Worker | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| hoox | `/` | POST | Main webhook entry |
| trade-worker | `/process` | POST | Execute trade |
| trade-worker | `/webhook` | POST | Alt trade entry |
| trade-worker | `/api/signals` | GET/POST | Signal CRUD |
| telegram-worker | `/process` | POST | Send notification |
| telegram-worker | `/webhook` | POST | Telegram updates |
| d1-worker | `/query` | POST | Execute SQL |
| d1-worker | `/api/dashboard/stats` | GET | Dashboard metrics |
| d1-worker | `/api/dashboard/positions` | GET | Active positions |
| agent-worker | `/agent/status` | GET | Agent health |
| agent-worker | `/agent/risk-override` | POST | Kill switch control |
| home-assistant | `/process` | POST | HA service call |
| web3-wallet | `/` | GET | Initialize wallet |

---

## 10. Docker & Local Development

### 10.1 Docker Ports

| Service | Port |
|---------|------|
| hoox (gateway) | 8787 |
| trade-worker | 8788 |
| d1-worker | 8789 |
| telegram-worker | 8790 |
| home-assistant | 8791 |
| web3-wallet | 8792 |
| dashboard | 8783 |
| agent-worker | 8795 |
| email-worker | 8796 |

### 10.2 Dev Server Commands

```bash
# Dev server for single worker
hoox workers dev hoox

# Or directly with wrangler
bunx wrangler dev --port 8787

# Dashboard (Next.js)
cd workers/dashboard && bun run dev
```

### 10.3 Deploy Commands

```bash
# Deploy standard Workers
hoox workers deploy

# Deploy Dashboard (Cloudflare Pages + Next.js)
cd workers/dashboard
bun run build && bunx @cloudflare/next-on-pages && bunx wrangler pages deploy .vercel/output/static --project-name hoox-dashboard --commit-dirty
```

### 10.3 Environment Files

Development uses `.dev.vars` files in each worker directory:

```bash
# Copy example and fill in values
cp workers/hoox/.dev.vars.example workers/hoox/.dev.vars
```

---

## 11. Feature Matrix

| Feature | hoox | trade | telegram | agent | d1 | web3 | home |
|---------|------|-------|----------|-------|-----|------|------|
| API Key Auth | ✅ | ✅ | ✅ | - | - | ✅ | - |
| IP Allowlist | ✅ | - | - | - | - | - | - |
| Service Binding | - | ✅ | ✅ | ✅ | - | - | - |
| D1 Storage | - | ✅ | - | ✅ | ✅ | - | - |
| R2 Storage | - | ✅ | ✅ | - | - | ✅ | - |
| KV Storage | ✅ | ✅ | ✅ | ✅ | - | - | ✅ |
| AI/Vectorize | - | - | ✅ | ✅ | - | - | - |
| Cron Triggers | - | - | - | ✅ | - | - | - |
| Cloudflare Pages | - | - | - | - | - | - | ✅ |
| Queues Producer | ✅ | - | - | - | - | - | - |
| Queues Consumer | - | ✅ | - | - | - | - | - |
| Durable Objects | ✅ | - | - | - | - | - | - |
| Rate Limiting | ✅ | - | - | - | - | - | - |

---

## 12. Free Tier Usage

| Service | Free Limit | Notes |
|---------|-----------|-------|
| Workers | 100k req/day | Per day |
| D1 | 5M rows read/day, 100k writes/day, 5GB | Rows read/written per day |
| KV | 1GB stored, 1k ops/day | Per day |
| R2 | 10GB storage | Monthly |
| Queues | 10k ops/day | ~3k trades/day |
| Durable Objects | SQLite-backed only | Free tier compatible |
| Workers AI | 10k neurons/day | For AI summaries |

---

## 13. Installation Flow

### 13.1 Prerequisites

- Bun ≥1.2
- Cloudflare account
- Wrangler CLI

### 13.2 Setup Wizard (7 Steps)

1. **Check Dependencies** - Verifies bun and wrangler
2. **Configure Global Settings** - API token, account ID, Secret Store ID, subdomain prefix
3. **Select Workers** - Choose which workers to enable
4. **Setup D1 Database** - Auto-creates if needed
5. **Save Configuration** - Writes to workers.jsonc
6. **Configure Secrets** - Guides through secret setup
7. **Initial Deployment** - Optional deploy

### 13.3 Configuration Formats

The system supports two configuration file formats:

**workers.jsonc** (preferred):
```toml
[global]
cloudflare_api_token = "your_api_token"
cloudflare_account_id = "your_account_id"
cloudflare_secret_store_id = "your_secret_store_id"
subdomain_prefix = "your-prefix"

[workers.d1-worker]
enabled = true
path = "workers/d1-worker"
vars = { database_name = "my-database" }
secrets = []
```

**config.jsonc** (JSON with Comments):
```jsonc
{
  "global": {
    "cloudflare_api_token": "your_api_token",
    "cloudflare_account_id": "your_account_id",
    "subdomain_prefix": "your-prefix"
  },
  "workers": {
    "d1-worker": {
      "enabled": true,
      "path": "workers/d1-worker"
    }
  }
}
```

> **Note for Agents/Developers:** The system enforces strict typing for all configuration files via the `WranglerConfig` and `Config` interfaces in `scripts/types.ts`. Avoid using `as any` when parsing or updating configurations. Always cast safely to the appropriate interface to maintain type safety across management scripts.

### 13.4 Secret Store Management

```bash
# Create a Secret Store
npx wrangler secrets-store store create <store-name>

# List stores to get ID
npx wrangler secrets-store store list

# Add secret to store
npx wrangler secrets-store secret put <secret-name> --store-id <store-id>

# List secrets in store
npx wrangler secrets-store secret list --store-id <store-id>
```

### 13.5 Troubleshooting

- **Wizard Interrupted**: Progress saved in `.install-wizard-state.json`, run wizard again to continue
- **Secret Binding Issues**: Verify secrets with `wrangler secrets-store secret list --store-id <id>`
- **Check Worker Status**: `hoox workers status`
- **Deployment Failures**: Run `wrangler tail <worker-name>` to view logs

### 13.6 Docker (Self-Hosting)

```bash
# Development with hot-reload
bun run docker:dev

# Production build
bun run docker:prod
```

Docker environment variables:
```bash
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_id
```

### 13.3 Quick Start

```bash
# Bootstrap via hoox CLI
bunx @hoox/cli clone hoox-setup
cd hoox-setup

# Install dependencies and setup configs
bun install
hoox config setup

# Run setup wizard
hoox init

# Deploy
hoox workers deploy
```

---

## Appendix: Environment Variables Reference

| Variable | Worker | Description |
|----------|--------|-------------|
| `cloudflare_api_token` | global | Cloudflare API token |
| `cloudflare_account_id` | global | Cloudflare account ID |
| `subdomain_prefix` | global | Worker subdomain prefix |
| `TRADE_WORKER_NAME` | hoox, email-worker | Trade service name |
| `TELEGRAM_WORKER_NAME` | hoox | Telegram service name |
| `DEFAULT_LEVERAGE` | trade-worker | Default leverage |
| `USE_TESTNET` | trade-worker | Use testnet |
| `USE_IMAP` | email-worker | Enable IMAP |
| `DASHBOARD_USER` | dashboard | Dashboard username |
| `DASHBOARD_PASS` | dashboard | Dashboard password |
| `DEFAULT_CHAT_ID` | telegram-worker | Default Telegram chat |
| `HA_SECURE_URL` | home-assistant | Home Assistant URL |
| `HA_TOKEN` | home-assistant | Home Assistant token |

---

## 14. Design Ruleset (Dashboard)

- **Theme**: Dark mode by default (`bg-black`, `bg-neutral-950`).
- **Brand Colors**: Hoox signature orange (`orange-500`, `orange-600`) for primary actions.
- **Textures**: Ambient background glows, noise overlays, and grid patterns for depth.
- **Cards**: `border-neutral-800 bg-neutral-950/80 backdrop-blur-xl shadow-2xl`.
- **Typography**: Uppercase, tracked-out labels (`text-xs uppercase tracking-wider text-neutral-400 font-semibold`).
- **Animations**: Subtle `framer-motion` entrances (opacity and y-axis slides).
- **Security**: Emphasize trust with icons (`Shield`, `Lock`) and clear error states.

---

*Cloudflare and the Cloudflare logo are trademarks of Cloudflare, Inc.*