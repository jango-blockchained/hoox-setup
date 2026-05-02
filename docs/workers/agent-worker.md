# Agent Worker - Hoox Autonomous AI & Risk Manager

**Last Updated:** May 2026

The `agent-worker` is the autonomous intelligence and protection layer of the Hoox stack. It executes on a schedule (every 5 minutes) to actively supervise risk, monitor open positions, and coordinate defensive/optimization actions across internal workers.

## Core Capabilities

| Feature | Description |
| --- | --- |
| ⏱️ **Cron-Based Supervision** | Runs on a `*/5 * * * *` cron to continuously evaluate market state and account exposure without waiting for incoming webhooks. |
| 🛡️ **Portfolio Kill Switch** | Computes account-level drawdown and flips `trade:kill_switch=true` when configured loss limits are breached to block new entries upstream. |
| 🎯 **Adaptive Trailing Stops** | Tracks symbol watermarks in `CONFIG_KV` and emits `CLOSE` actions when price retraces beyond trailing thresholds. |
| 💸 **Partial Take-Profit Automation** | Supports staged exits when profit targets are reached to lock gains while preserving trend participation. |
| 🧠 **AI-Based Diagnostics** | Pulls runtime/system logs from `d1-worker`, summarizes anomalies, and emits operator-ready health snapshots to Telegram. |
| 🌐 **Provider Fallback Chain** | Uses an ordered model/provider fallback flow (Workers AI → OpenAI → Anthropic → Google) for resilience. |
| 🔍 **Health & Model Introspection** | Exposes endpoints to inspect provider readiness, active config, and model availability to simplify operations. |

## End-to-End Runtime Flow

1. **Scheduled Trigger:** Cloudflare Cron invokes `agent-worker`.
2. **State Collection:** Fetches open positions and risk context through internal service bindings.
3. **Market Refresh:** Pulls current mark prices from configured exchanges.
4. **Risk Decisioning:** Applies drawdown checks, trailing logic, and profit rules.
5. **AI Reasoning Layer:** Optionally summarizes system state and recommends operator actions.
6. **Action Dispatch:** Sends close/adjust actions to `trade-worker`; sends alerts/summaries to `telegram-worker`.

## API Surface

### Configuration & Operations

#### `GET /agent/config`
Returns current runtime configuration.

#### `POST /agent/config`
Updates runtime configuration (provider chain, model map, thresholds, timeout/retries) without redeploy.

#### `GET /agent/models`
Lists models discovered from Workers AI and configured external providers.

#### `POST /agent/test-model`
Runs a provider/model sanity request to validate connectivity and latency.

#### `GET /agent/health`
Returns health probes for configured providers.

### AI Utilities

#### `POST /agent/chat`
Executes a prompt with provider fallback, optional system prompt, temperature, and token controls.

#### `POST /agent/embedding`
Generates embeddings (typically Workers AI embedding models).

### Risk Controls (Legacy/Compatibility)

#### `POST /agent/risk-override`
Manually engages or releases safety controls.

#### `GET /agent/status`
Returns live agent status, including risk state and trailing-stop activity.

## Configuration Model

### KV Keys

| KV Key | Default | Description |
| --- | --- | --- |
| `agent:config` | JSON object | Main runtime provider/risk config |
| `agent:openai_key` | - | OpenAI API key |
| `agent:anthropic_key` | - | Anthropic API key |
| `agent:google_key` | - | Google API key |
| `trade:max_daily_drawdown_percent` | `-5` | Drawdown limit that activates kill switch |
| `trade:kill_switch` | `false` | Global guard that blocks new entries |
| `trade:watermark:{exchange}:{symbol}:{side}` | N/A | Per-position trailing watermark |

### Example Default Config

```json
{
  "defaultProvider": "workers-ai",
  "fallbackChain": ["workers-ai", "openai", "anthropic"],
  "modelMap": {
    "workers-ai": "@cf/meta/llama-3.1-8b-instruct",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-latest",
    "google": "gemini-1.5-flash"
  },
  "timeoutMs": 30000,
  "retryCount": 3,
  "maxDailyDrawdownPercent": -5,
  "trailingStopPercent": 0.05,
  "takeProfitPercent": 0.1
}
```

## Internal Service Dependencies

`agent-worker` expects internal service bindings rather than public endpoints:

- `D1_SERVICE` → portfolio state + system logs
- `TRADE_SERVICE` → order execution and partial/close actions
- `TELEGRAM_SERVICE` → notifications and incident broadcasts
- `CONFIG_KV` → dynamic configuration, kill switch, watermark persistence
- `AI` → Workers AI inference binding

## Operational Notes

- Keep risk thresholds conservative in production and tune per exchange volatility.
- Prefer provider fallback chains with at least one external provider for resilience.
- Track `agent:config` changes through controlled deployment workflows.
- Never store plaintext secrets in source; provision keys via Wrangler/Hoox secret flows.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
