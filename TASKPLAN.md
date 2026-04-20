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
    *   Setup Cloudflare Worker Cron Triggers (`scheduled` event) in `agent-worker/wrangler.toml` to run every 1-5 minutes.
    *   During execution, the agent queries `d1-worker` for all rows where `status = 'OPEN'`.
    *   The agent then queries exchange APIs (via a new `/market` endpoint on `trade-worker` or direct lightweight clients) to get the live `mark_price` for those specific symbols.
*   **Use Case:** Calculates real-time Unrealized PnL, distance to liquidation, and time-in-trade metrics without relying on the dashboard frontend.

### B. Risk Management Engine (The "Shield")
*   **Implementation:**
    *   **Global Kill Switch:** The agent checks the Cloudflare KV (`CONFIG_KV`) for a global risk threshold (e.g., `max_daily_drawdown: -5%`). If the calculated account-wide PnL drops below this, the agent flips the `kill_switch` to `true` in the KV, blocking the `hoox` worker from accepting new trades.
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

*   **Cron Frequency vs. Execution Cost:** Running a cron every 1 minute ensures tight risk management but consumes more Cloudflare Worker requests. Every 5 minutes is cheaper but riskier for highly leveraged scalps.
*   **Exchange API Rate Limits:** If the agent pulls market data for every open position every minute, it could hit Binance/MEXC rate limits. *Solution:* Route all market queries through a cached KV layer or a single centralized function.
*   **State Management:** Tracking the "Highest Watermark" for trailing stops requires fast, persistent storage. D1 might be too slow/costly for per-minute updates. *Solution:* Use Cloudflare KV or Durable Objects for active trade state.
