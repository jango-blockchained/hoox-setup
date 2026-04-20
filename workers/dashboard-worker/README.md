# 📊 dashboard-worker - Hoox UI & Settings Manager

<div align="center">

[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare®%20Pages-orange?logo=cloudflare)](https://pages.cloudflare.com/)

</div>

> The `dashboard-worker` is the visual command center of the Hoox trading ecosystem. Built as a fast, edge-rendered web application, it provides real-time insights into your portfolio and allows for dynamic configuration of the entire system without code redeploys.

## ✨ Core Capabilities

| Feature | Description |
|---|---|
| 📈 **Real-Time Portfolio Tracking** | Aggregates active positions, trade history, and system logs across all exchanges into a unified dashboard. |
| 🎛️ **Dynamic KV Configuration** | Instantly update risk limits, default leverage, and API keys. Changes write directly to `CONFIG_KV` and are immediately respected by the `hoox` and `agent-worker`. |
| 🛑 **Global Kill Switch Toggle** | A dedicated UI element to manually halt all automated trading during extreme market volatility. |
| 📉 **Performance Analytics** | Visualizes win rates, total PnL, and AI-generated system health summaries. |
| 🔒 **Secure Access** | Protected by Cloudflare® Access (Zero Trust) to ensure enterprise-grade security for your trading terminal. |

## 🏗️ Architecture & Flow

The dashboard is designed to be lightweight. It does not directly manage trades. Instead:
1. **Reads:** It pulls aggregated statistics and historical logs via the `d1-worker`'s `/api/dashboard/*` endpoints.
2. **Writes:** Form submissions (like updating the max drawdown) write directly to the shared `CONFIG_KV` namespace.
3. **Actions:** Emergency actions (like closing a position) dispatch a payload to the `hoox` gateway.

## 🚀 Local Development

To run the dashboard locally and interact with your remote (or local) D1 and KV instances:

```bash
# From the hoox-setup root
cd workers/dashboard-worker

# Install frontend dependencies (if not using bun globally)
bun install

# Start the local development server
npm run dev
```

## 🔧 Internal Service Endpoints Used

The dashboard relies on the following internal APIs:

| Endpoint | Worker | Purpose |
|---|---|---|
| `GET /api/dashboard/stats` | `d1-worker` | High-level metrics (Total Trades, Win Rate). |
| `GET /api/dashboard/positions` | `d1-worker` | List of currently `OPEN` positions. |
| `GET /api/dashboard/logs` | `d1-worker` | Recent system and AI log events. |
| `POST /agent/risk-override` | `agent-worker`| Manual override triggers. |


---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
