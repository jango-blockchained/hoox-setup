# Hoox Dashboard & Agents Expansion Plan

This document outlines the roadmap and architecture for enriching the Hoox Dashboard into a professional, production-ready trading command center, along with the necessary agent and worker upgrades to support it.

---

## 1. Database & Architecture Upgrades
Currently, the `d1-worker` tracks basic `trade_signals`. To support a rich dashboard, we need to expand the database schema and build dedicated API endpoints.

*   **Schema Expansion:** Create dedicated tables for `trades` (executions), `positions` (active/closed), `balances` (exchange snapshots), and `system_logs`.
*   **Dedicated Dashboard APIs:** Add routes to the `d1-worker` (e.g., `/api/dashboard/stats`, `/api/dashboard/positions`) to efficiently aggregate data (like calculating Win Rate or PnL) so the dashboard worker remains lightweight.
*   **State Management (KV):** Move static configurations (like the TradingView IP allowlist or default leverage) from hardcoded environment variables into the Cloudflare® KV (`CONFIG_KV`), allowing them to be updated in real-time from the dashboard.

## 2. Core Dashboard Pages & Features

### 📊 Overview (Home)
*   **Advanced Metrics:** Go beyond "Total Trades". Add **Win Rate**, **Total PnL** (Profit & Loss), **Daily Volume**, and **Active Exchange Connections**.
*   **Interactive Charts:** Integrate a lightweight charting library (like Chart.js or Recharts) to visualize PnL over time, equity curves, and signal frequency.
*   **Worker Health:** A status widget that pings every worker (`hoox`, `trade-worker`, `telegram-worker`, etc.) to show their live latency and uptime status.

### 🗂️ Trades & Signals
*   **Signal vs. Execution Tracker:** A detailed table showing incoming signals (from TradingView/Email) mapped to their actual execution status on the exchange.
*   **Trade History:** A paginated table of historical trades with filtering (by symbol, exchange, date, or action).
*   **Export:** Ability to export trade history to CSV for tax or analysis purposes.

### 🎯 Active Positions
*   **Live Portfolio:** A dedicated page aggregating open positions across all connected exchanges (Binance, MEXC, Bybit, DEXs).
*   **Position Details:** Display Unrealized PnL, Entry Price, Current Mark Price, Leverage, and Liquidation Price.
*   **Quick Actions:** Add "Close Position" buttons that trigger the `trade-worker` directly from the dashboard.

### ⚙️ Settings & Configuration
A comprehensive settings page that writes to Cloudflare® KV, dynamically updating the framework's behavior without needing to redeploy code:
*   **Kill Switch:** A global "Pause Trading" toggle that stops the `hoox` gateway from forwarding execution requests to the `trade-worker` (useful during extreme market volatility).
*   **Security:** Manage the TradingView Webhook IP Allowlist and rotate internal API keys.
*   **Risk Management:** Configure default leverage, maximum position size (e.g., "Max $500 per trade"), and daily loss limits.
*   **Routing & Notifications:** Manage Telegram Chat IDs, toggle email scanning (`USE_IMAP`), and adjust alert verbosity (e.g., "Only alert on errors").

### 📜 System Logs & Observability
*   **Live Event Feed:** A real-time log viewer pulling from a D1 `system_logs` table, showing everything from webhook parsing errors to AI embedding generation successes.

## 3. Security Enhancements
*   **Authentication:** Upgrade from Basic Auth to **Cloudflare® Access (Zero Trust)** for enterprise-grade security, or implement a secure login flow using encrypted cookies and short-lived JWTs.
*   **Passkeys (WebAuthn):** Add support for biometric logins (FaceID/TouchID) for seamless and highly secure access.

---

## Implementation Phasing

1.  **Phase 1: Data Foundation.** Update the `schema.sql` in `trade-worker` and `d1-worker` to track actual trades, positions, and logs. Update the `d1-worker` routes to serve this data.
2.  **Phase 2: KV Settings.** Wire the `dashboard-worker` to read/write settings to `CONFIG_KV`, and update `hoox` and `trade-worker` to respect those dynamic settings.
3.  **Phase 3: UI Expansion.** Add the new pages (Positions, Settings, Logs) to the `dashboard-worker`'s JSX renderer, complete with the Cloudflare® dark theme.
4.  **Phase 4: Advanced Features.** Add charts, WebAuthn (Passkeys), and export functionality.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
