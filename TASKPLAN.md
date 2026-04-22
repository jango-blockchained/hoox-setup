# Agent-Worker Implementation Plan

## 1. Conceptual Architecture & Role

The `agent-worker` acts proactively. It serves as an intelligent, autonomous layer that runs on a schedule (cron) and via direct queries to continuously evaluate the health of the portfolio and make real-time decisions.

**Key Responsibilities:**
*   **Observer:** Constantly fetches real-time market data and cross-references it with open positions in `d1-worker`.
*   **Risk Manager:** Enforces strict drawdown limits, stop-losses, and dynamic leverage adjustments.
*   **Executor:** Dispatches commands to `trade-worker` when interventions (like emergency liquidations or partial takes of profit) are required.

## 2. Core Modules & Implementation Plan

### A. Position & Market Monitoring (The "Observer")
*   **Implementation:** 
    *   Setup Cloudflare® Worker Cron Triggers (`scheduled` event) in `agent-worker/wrangler.toml` to run every 1-5 minutes.
    *   During execution, the agent queries `d1-worker` for all rows where `status = 'OPEN'`.
    *   The agent then queries exchange APIs (via a new `/market` endpoint on `trade-worker` or direct lightweight clients) to get the live `mark_price` for those specific symbols.
*   **Use Case:** Calculates real-time Unrealized PnL, distance to liquidation, and time-in-trade metrics without relying on the dashboard frontend.

### B. Risk Management Engine (The "Shield")
*   **Implementation:**
    *   **Global Kill Switch:** The agent checks the Cloudflare® KV (`CONFIG_KV`) for a global risk threshold (e.g., `max_daily_drawdown: -5%`). If the calculated account-wide PnL drops below this, the agent flips the `kill_switch` to `true` in the KV, blocking the `hoox` worker from accepting new trades.
    *   **Exposure Limits:** Before an AI-driven or signal-driven trade is passed to `trade-worker`, the agent checks if the asset concentration is too high (e.g., "Already 50% exposed to BTC, reject new LONG").
*   **Use Case:** Prevents flash crashes from wiping out the portfolio and overrides emotional or erroneous TradingView webhook spam.

### C. Position Management (The "Optimizer")
*   **Implementation:**
    *   **Trailing Stops:** The agent maintains a local state (or in D1/KV) of the "Highest Watermark Price" for an asset since the position opened. If the live price drops by $X\%$ from the watermark, it automatically sends a `CLOSE_LONG` payload to `trade-worker`.
    *   **Scaling Out:** If a position reaches $+10\%$ PnL, the agent constructs a payload to close 50% of the `quantity` to secure profit.
*   **Use Case:** Automates trade management so you don't have to stare at the chart. Trades can be entered via Webhook, but exited intelligently by the Agent.

### D. Trade Intelligence & Markets (The "Brain")
*   **Implementation:**
    *   Leverage the `@cloudflare/ai` binding in the agent. Periodically, the agent can fetch the last 100 system logs or recent trades, feed them into a LLaMA model, and output a "Market/System Health Summary".
    *   The agent can subscribe to high-volatility alerts and pass natural language summaries directly to the `telegram-worker`.
*   **Use Case:** "BTC volume spiked 300% in 5 minutes, but your LONG position is safely in profit. Trailing stop moved up to entry."

## 3. Required Endpoints & Interactions

To make this work seamlessly with your existing stack, the `agent-worker` will need the following internal connections:

1.  **To `d1-worker`:** Fetch active positions and log its own actions into `system_logs`.
2.  **To `trade-worker`:** 
    *   Send execution commands (`POST /process`).
    *   *(Proposed)* Fetch centralized market data so the agent doesn't need its own set of exchange API keys.
3.  **To `telegram-worker`:** Send real-time alerts when the risk engine triggers an action (`POST /webhook` via service binding).
4.  **Exposed Agent Endpoints:**
    *   `POST /agent/risk-override`: For manual force of a risk configuration via Telegram/Dashboard.
    *   `GET /agent/status`: Returns the current health and active trailing stops tracked by the agent.

## 4. Trade-offs to Consider Before Implementation

*   **Cron Frequency vs. Execution Cost:** Running a cron every 1 minute ensures tight risk management but consumes more Cloudflare® Worker requests. Every 5 minutes is cheaper but riskier for highly leveraged scalps.
*   **Exchange API Rate Limits:** If the agent pulls market data for every open position every minute, it could hit Binance/MEXC rate limits. *Solution:* Route all market queries through a cached KV layer or a single centralized function.
*   **State Management:** Tracking the "Highest Watermark" for trailing stops requires fast, persistent storage. D1 might be too slow/costly for per-minute updates. *Solution:* Use Cloudflare® KV or Durable Objects for active trade state.


---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*


# Bun native usage plan

1. Bun's built-in SQLite usage
2. Bun's built-in Redis usage
3. Bun's test runner features
4. Bun.Transpiler usage
5. Bun.cron usage
6. Bun.serve improvements
7. Bun.spawn/spawnSync features
8. Any manual implementations that could use Bun native APIs
Now let me analyze which native Bun features could replace existing dependencies:
✱ Grep "import.*from.*sqlite|import.*from.*better-sqlite|pkg.*sqlite" (2 matches)
✱ Grep "import.*from.*redis|import.*from.*ioredis" 
✱ Grep "Bun\.spawn|Bun\.spawnSync" 
Thinking: Now let me check what's available in the codebase. I should check:
1. If they're using bun:test properly
2. If they're using bun-specific APIs like Bun.sqlite, Bun.udpSocket, Bun.cron
3. If they're using the latest Bun features properly
Let me check more patterns.
✱ Grep "bun:test|describe\(|test\(" (345 matches)
✱ Grep "itty-router" 
Thinking: Let me search for more patterns to understand what's using Bun features and what's not.
✱ Grep "hono|Hono" (13 matches)
→ Read workers/hoox/src/index.ts 
Thinking: Now let me look at more recent Bun features to understand what can be leveraged. Let me check if there's any usage of:
1. Bun's built-in SQLite client (bun:sqlite)
2. Bun.cron
3. Bun.UDP socket
4. Bun.WebView
5. Bun's built-in Redis client (if available)
6. Bun's built-in MySQL client
7. Bun's test runner's fake timers (jest.useFakeTimers)
Let me also search for other things:
◈ Exa Web Search "Bun 1.4 new features 2026 Bun.sh blog" 
✱ Grep "Bun\.SQL|Bun\.mysql|bun:sqlite" 
Thinking: Now I have enough info to compile a comprehensive plan. Let me analyze:
Current Bun usage:
- Bun 1.3.12 (latest is 1.3.13)
- Uses bun:test for testing (good)
- Uses "type": "module" in package.json (good)
- Uses bun for scripts and testing
- Does NOT use:
  - bun:sqlite (uses D1 instead - appropriate for Cloudflare Workers)
  - bun:sqlite client - uses D1
  - Bun.UDP 
  - Bun.cron
  - Bun.WebView
  - Bun.serve() full-stack (they use wrangler)
  - Bun.Archive
  - Bun.JSON5
  - Bun.wrapAnsi
  - Bun.Transpiler
  - Workspace features
Submodules analysis:
All 8 workers are git submodules with their own package.json
Missing opportunities:
1. Bun package manager features not used:
   - Workspace monorepo (each worker is separate submodule, not workspace)
   - Catalogs
   - Isolated installs
2. Not using native Bun APIs:
   - Bun.env for env vars
   - Native test features like fake timers (they might use jest)
   - Better use of bun:test
3. Could use:
   - Bun.inspect() for debugging
   - Bun.stringWidth() for terminal (they use blessed)
   - Native JSONC parsing (Bun.JSONC) for config files instead of @iarna/toml
   - Could replace postgres package with native Bun.SQL
4. Potential optimizations:
   - Update bun-types to latest
   - Upgrade bun version
   - Consider using Bun's built-in PostgreSQL client instead of external postgres package
Let me compile a plan now.
Now I have enough information to provide a comprehensive plan.
---
Analysis Summary
Current State
- Bun Version: 1.3.12 (latest is 1.3.13)
- 8 submodules: All workers are separate git submodules, not Bun workspaces
- Testing: Uses bun:test (good) + vitest in trade-worker
- Config: Uses @iarna/toml for TOML parsing (could use native Bun.file().json())
Missing Bun Native Features
Feature
bun:sqlite
Bun.SQL (PostgreSQL)
Bun.cron()
Bun.WebView
Bun.Archive
Bun.JSON5/Bun.JSONC
Bun.wrapAnsi()
Bun.env
Bun.inspect()
Bun.serve()
Workspace catalogs
Bun.hash()
---
Proposed Plan
1. Upgrade Bun to 1.3.13 (Low Priority)
bun upgrade
- Already available as patch release
2. Update bun-types (Medium Priority)
Update in all 9 package.json files:
"bun-types": "^1.3.13"  // currently ^1.3.13 but pinned to old
- Ensures latest TypeScript types for new APIs
3. Replace @iarna/toml with Native Parsing (Medium Priority)
bun:sqlite and Bun.file() can parse TOML natively:
import { parse } from "bun:toml"; // Native TOML support
// Replace @iarna/toml usage in manage.ts and config loading
- Remove @iarna/toml dependency
- Use Bun.file(path).text() + parse() or JSON.parse()
4. Use Bun.env Instead of process.env (Low Priority)
// Replace
const token = process.env.API_TOKEN;
// With
const token = Bun.env.API_TOKEN;
- More performant, type-safe
5. Use Bun.inspect() for Debug Logging (Low Priority)
import { inspect } from "bun";
console.log(inspect(data, { colors: true, depth: 4 }));
6. Replace ansis with Bun.wrapAnsi() (Low Priority)
In package.json root and hoox-tui:
import { wrapAnsi } from "bun";
- 33-88x faster than wrap-ansi npm package
7. Consider Bun Workspaces Over Submodules (High Complexity)
Instead of 8 git submodules, use Bun workspaces:
{
  "name": "hoox-setup",
  "workspaces": ["workers/*"]
}
- Better dependency deduplication
- Single bun install for all workers
- Note: Would require restructuring from submodules to local packages
8. Use Bun.hash() for Request IDs (Low Priority)
Replace crypto.randomUUID() with faster:
const id = Bun.hash(Math.random().toString());
---
Recommendation
Would you like me to proceed with:
1. Quick wins (1, 2, 4, 8) - Low risk, immediate benefits
2. Medium effort (3, 5, 6) - Replace packages with native APIs
3. Full migration (7) - Restructure to Bun workspaces



# Security Hardening TODOs

Last updated: 2026-04-21

## Critical

- [x] Add strict internal authentication for `d1-worker` (`/query`, `/batch`, dashboard APIs).
- [x] Require internal authentication on `trade-worker` `/webhook`.
- [x] Protect `agent-worker` admin/control endpoints with internal auth.
- [x] Remove dashboard default credentials and require explicit secrets.

## High

- [x] Gate test/debug endpoints behind an explicit `ENABLE_DEBUG_ENDPOINTS=true` flag (hoox, trade-worker, telegram-worker).
- [x] Verify and enforce webhook signature validation for email provider webhooks.
- [x] Add CSRF protection for dashboard state-changing POST routes.
- [x] Remove raw HTML injection risk in dashboard settings form rendering.
- [ ] Redact sensitive headers/body fields from request/response logs.

## Dependency Risk

- [ ] Upgrade vulnerable runtime dependency chains in `workers/trade-worker` (axios/bybit-api/
      form-data/basic-ftp/serialize-javascript).
- [ ] Upgrade vulnerable chain in `workers/web3-wallet-worker` (`basic-ftp` via puppeteer tree).
- [ ] Upgrade vulnerable chain in `workers/email-worker` (`semver` via imap stack).
- [ ] Refresh remaining lockfiles to clear high/moderate dev-chain advisories where feasible.

## Repo / CI Hardening

- [ ] Pin third-party GitHub Actions to immutable SHAs (replace `@latest`).
- [ ] Reduce CI token permissions to least privilege where possible.
- [ ] Remove/replace placeholder or local plaintext key material from development paths.

## Test Updates

- [x] d1-worker tests: Updated with internal auth tests (10 tests pass)
- [x] trade-worker tests: Updated webhook auth tests (104 tests pass)
- [x] agent-worker tests: Updated with internal auth tests (20 tests pass)
- [x] email-worker tests: Added Mailgun signature verification tests (needs debugging)
- [ ] email-worker tests: FormData Content-Type issue causes Mailgun webhook tests to fail (known issue)

## Completed Work Notes

- Completed: debug endpoint gating, dashboard auth fallback removal.
- Completed: internal auth for d1-worker, trade-worker webhook, agent-worker.
- Completed: Mailgun webhook signature verification.
- Completed: CSRF protection for settings and positions POST routes.
- Completed: HTML escaping in dashboard form rendering.
- Completed: Tests updated for all workers with auth requirements.
