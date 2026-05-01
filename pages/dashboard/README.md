# 📊 dashboard - Hoox UI & Settings Manager

<div align="center">

[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare%20Pages-orange?logo=cloudflare)](https://pages.cloudflare.com/)

</div>

> The `dashboard` is the visual command center of the Hoox trading ecosystem. Built as a fast, edge-rendered web application, it provides real-time insights into your portfolio and allows for dynamic configuration of the entire system without code redeploys.

## ✨ Core Capabilities

| Feature | Description |
|---|---|
| 📈 **Real-Time Portfolio Tracking** | Aggregates active positions, trade history, and system logs across all exchanges into a unified dashboard. |
| 🎛️ **Dynamic KV Configuration** | Instantly update risk limits, default leverage, and API keys. Changes write directly to `CONFIG_KV` and are immediately respected by the `hoox` and `agent-worker`. |
| 🛑 **Global Kill Switch Toggle** | A dedicated UI element to manually halt all automated trading during extreme market volatility. |
| 📉 **Performance Analytics** | Visualizes win rates, total PnL, and AI-generated system health summaries. |
| 🔒 **Secure Access** | Protected by Cloudflare® Access (Zero Trust) to ensure enterprise-grade security for your trading terminal. |
| ⚙️ **Schema-Driven Settings** | Extensible configuration system with type-safe settings form generation. |

## 🏗️ Architecture & Flow

The dashboard is designed to be lightweight. It does not directly manage trades. Instead:
1. **Reads:** It pulls aggregated statistics and historical logs via the `d1-worker`'s `/api/dashboard/*` endpoints.
2. **Writes:** Form submissions (like updating the max drawdown) write directly to the shared `CONFIG_KV` namespace.
3. **Actions:** Emergency actions (like closing a position) dispatch a payload to the `hoox` gateway.

## 🔧 Configuration Schema

The dashboard uses a schema-based configuration system defined in `config.schema.json` and `src/config.ts`.

### Default Configuration Sections

| Section | Description | Key Prefix |
|---|---|---|
| ⚡ **Global Settings** | System-wide configuration | `global:` |
| 🔒 **Security** | Webhook and API security | `webhook:`, `global:` |
| ⚠️ **Risk Management** | Position sizing and limits | `trade:` |
| 🤖 **Agent Configuration** | AI agent and automation | `agent:` |
| 🔔 **Notifications** | Alert settings | `notify:` |

### Configuration Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `global:kill_switch` | boolean | `false` | Pause all trading |
| `global:maintenance_mode` | boolean | `false` | Show maintenance page |
| `webhook:tradingview:ip_check_enabled` | boolean | `true` | Validate TradingView IPs |
| `webhook:tradingview:allowed_ips` | json | `[]` | Allowed IP array |
| `trade:default_leverage` | number | - | Default position leverage |
| `trade:max_position_size` | number | - | Max position in USD |
| `trade:max_daily_drawdown_percent` | number | `-5` | Kill switch trigger |
| `agent:default_provider` | select | `workers-ai` | AI provider |
| `agent:timeout_ms` | number | `30000` | AI request timeout |
| `agent:retry_count` | number | `3` | AI retry attempts |
| `notify:telegram_enabled` | boolean | - | Telegram alerts |
| `notify:email_enabled` | boolean | - | Email alerts |

### Extending Configuration

To add new settings, update `config.schema.json`:

```json
{
  "sections": [
    {
      "id": "custom",
      "title": "Custom Settings",
      "fields": [
        {
          "key": "custom:my_setting",
          "label": "My Setting",
          "type": "text",
          "category": "custom"
        }
      ]
    }
  ]
}
```


## 🔐 Canonical Environment Variables

Use only these canonical keys for service URLs and internal auth in the dashboard APIs:

| Variable | Purpose |
|---|---|
| `D1_SERVICE_URL` | Base URL for `d1-worker` service calls |
| `TRADE_SERVICE_URL` | Base URL for `trade-worker` service calls |
| `AGENT_SERVICE_URL` | Base URL for `agent-worker` service calls |
| `TELEGRAM_SERVICE_URL` | Base URL for `telegram-worker` service calls |
| `D1_INTERNAL_KEY` | Internal auth key for d1 service calls |
| `AGENT_INTERNAL_KEY` | Internal auth key for agent service calls |
| `TELEGRAM_INTERNAL_KEY` | Internal auth key for telegram service calls |
| `API_SERVICE_KEY` | Shared internal API key |
| `DASHBOARD_USER` | Basic auth username |
| `DASHBOARD_PASS` | Basic auth password |

Non-canonical alternates (for example `agentService_URL` or `D1_WORKER_URL`) are not supported.

## 🚀 Local Development

```bash
cd pages/dashboard
bun install
bun run dev
```

## ☁️ Deploy to Cloudflare Pages

```bash
cd pages/dashboard
bunx opennextjs-cloudflare build && bunx wrangler pages deploy .open-next --project-name hoox-dashboard --commit-dirty
```

Or using the hoox CLI:
```bash
hoox pages deploy
```

## 📁 File Structure

## 🔧 Internal Service Endpoints Used

| Endpoint | Worker | Purpose |
|---|---|---|
| `GET /api/dashboard/stats` | `d1-worker` | High-level metrics (Total Trades, Win Rate). |
| `GET /api/dashboard/positions` | `d1-worker` | List of currently `OPEN` positions. |
| `GET /api/dashboard/logs` | `d1-worker` | Recent system and AI log events. |
| `POST /agent/risk-override` | `agent-worker`| Manual override triggers. |

## 📁 File Structure

```
dashboard/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/settings/route.ts     # Settings API endpoints
│   │   └── ...
│   ├── components/                    # UI components
│   │   ├── dashboard/               # Dashboard components
│   │   └── ui/                      # shadcn-ui components
│   ├── lib/
│   │   ├── settings/                # Modular settings system
│   │   │   ├── types.ts            # Type definitions
│   │   │   └── loader.ts           # JSONC config loader
│   │   └── api.ts                  # API client
│   └── public/workers/              # Worker dashboard configs (*.jsonc)
├── public/workers/*.jsonc             # Each worker's dashboard config
├── wrangler.toml
└── README.md
```

## ⚙️ Modular Settings System

Each worker can define its settings via `dashboard.jsonc` in the `public/workers/` directory:

```jsonc
{
  "display_name": "Trade Worker",
  "description": "Multi-exchange trade execution",
  "sections": {
    "execution": {
      "title": "Execution",
      "description": "Trade execution settings",
      "icon": "zap",
      "priority": 10,
      "fields": {
        "default_leverage": 10,
        "max_position_usd": 1000
      }
    }
  }
}
```

Settings are stored in CONFIG_KV with key pattern `dashboard:{worker}:{key}`.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*