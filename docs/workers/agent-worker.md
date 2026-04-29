# Agent Worker - Hoox Autonomous AI & Risk Manager

**Last Updated:** April 2026

The `agent-worker` serves as the proactive intelligence layer of the Hoox trading ecosystem. Rather than waiting for webhooks, it runs continuously on a cron schedule to monitor portfolio health, enforce risk limits, and optimize position exits.

## Core Capabilities

| Feature                        | Description                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ⏱️ **Cron-Driven Observation** | Automatically runs every 5 minutes (`*/5 * * * *`) to fetch live market data from Binance, Bybit, and MEXC.                                   |
| 🛡️ **Global Kill Switch**      | Calculates total account PnL and instantly locks out the `hoox` gateway from new entries if the `max_daily_drawdown_percent` is breached.     |
| 🎯 **Dynamic Trailing Stops**  | Stores watermark prices in `CONFIG_KV` and automatically triggers `CLOSE` payloads if the market reverses.                                    |
| 💸 **Scale-Out Take Profits**  | Detects when a position reaches a specific profit target and automatically sends partial close commands to secure gains.                      |
| 🤖 **AI System Summarization** | Periodically fetches `system_logs` from the `d1-worker`, analyzes them via LLaMA 3 8B, and sends natural language health reports to Telegram. |
| 🌐 **Multi-Provider AI**       | Seamlessly switches between Workers AI, OpenAI, Anthropic, and Google AI with automatic fallbacks.                                            |
| 🧠 **Advanced Models**         | Supports vision, embeddings, reasoning, and code generation models.                                                                           |

## Architecture & Flow

1. **Trigger:** Cloudflare® Cron triggers the worker.
2. **State Sync:** Fetches active `OPEN` positions via the `d1-worker`.
3. **Market Pulse:** Pings public exchange APIs for the latest `markPrice`.
4. **Risk Evaluation:** Cross-references current price with KV-stored watermarks and global drawdown limits.
5. **AI Processing:** Uses configured AI provider with automatic fallback chain.
6. **Execution:** Dispatches actions to `trade-worker` (closing positions) and `telegram-worker` (alerts) via internal Service Bindings.

## Endpoints & Interactions

### Management Endpoints

#### `GET /agent/config`

Returns current agent configuration including provider settings.

```json
{
  "success": true,
  "config": {
    "defaultProvider": "workers-ai",
    "fallbackChain": ["workers-ai", "openai"],
    "modelMap": { ... },
    "trailingStopPercent": 0.05,
    "takeProfitPercent": 0.10
  }
}
```

#### `POST /agent/config`

Update agent configuration at runtime.

```json
{
	"defaultProvider": "openai",
	"fallbackChain": ["openai", "workers-ai", "anthropic"],
	"modelMap": {
		"workers-ai": "@cf/meta/llama-3.1-8b-instruct",
		"openai": "gpt-4o-mini-2024-07-18",
		"anthropic": "claude-3-haiku-20240307"
	},
	"timeoutMs": 30000,
	"retryCount": 3
}
```

#### `GET /agent/models`

Returns all available models from Cloudflare Workers AI and external providers.

#### `POST /agent/test-model`

Test a specific AI model.

```json
{
	"prompt": "Say hello",
	"model": "@cf/meta/llama-3.1-8b-instruct",
	"provider": "workers-ai"
}
```

#### `GET /agent/health`

Returns health status of all configured AI providers.

```json
{
	"success": true,
	"providers": {
		"workers-ai": { "healthy": true, "latency": 150 },
		"openai": { "healthy": true, "latency": 200 }
	}
}
```

### AI Interaction Endpoints

#### `POST /agent/chat`

Send a chat request with automatic provider fallback.

```json
{
	"prompt": "Analyze BTC market sentiment",
	"systemPrompt": "You are a professional crypto trading analyst.",
	"temperature": 0.7,
	"maxTokens": 500
}
```

#### `POST /agent/embedding`

Generate text embeddings using Workers AI embedding models.

```json
{
	"text": "Bitcoin price analysis for position sizing",
	"provider": "workers-ai"
}
```

### Legacy Endpoints

#### `POST /agent/risk-override`

Manually enforce or release risk locks.

```json
{
	"action": "engage_kill_switch",
	"reason": "Manual override from dashboard"
}
```

#### `GET /agent/status`

Retrieve the real-time health of the agent and active trailing stops.

## Configuration

### KV Keys

All configuration is stored in `CONFIG_KV` for real-time adjustments.

| KV Key                                       | Default     | Description                             |
| -------------------------------------------- | ----------- | --------------------------------------- |
| `agent:config`                               | JSON object | Main provider configuration             |
| `agent:openai_key`                           | -           | OpenAI API key                          |
| `agent:anthropic_key`                        | -           | Anthropic API key                       |
| `agent:google_key`                           | -           | Google AI API key                       |
| `trade:max_daily_drawdown_percent`           | `-5`        | Account PnL % that triggers Kill Switch |
| `trade:kill_switch`                          | `false`     | When `true`, halts all new trades       |
| `trade:watermark:{exchange}:{symbol}:{side}` | N/A         | High/low watermark                      |

### Default Agent Config

```json
{
	"defaultProvider": "workers-ai",
	"fallbackChain": ["workers-ai", "openai"],
	"modelMap": {
		"workers-ai": "@cf/meta/llama-3.1-8b-instruct",
		"openai": "gpt-4o-mini-2024-07-18",
		"anthropic": "claude-3-haiku-20240307",
		"google": "gemini-1.5-flash-002"
	},
	"timeoutMs": 30000,
	"retryCount": 3,
	"maxDailyDrawdownPercent": -5,
	"trailingStopPercent": 0.05,
	"takeProfitPercent": 0.1
}
```

### Supported Models

| Task          | Workers AI Model                               |
| ------------- | ---------------------------------------------- |
| Chat          | `@cf/meta/llama-3.1-8b-instruct`               |
| Vision        | `@cf/meta/llama-3.2-11b-vision-instruct`       |
| Reasoning     | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` |
| Code          | `@cf/qwen/qwen2.5-coder-32b-instruct`          |
| Embeddings    | `@cf/baai/bge-base-en-v1.5`                    |
| Summarization | `@cf/facebook/bart-large-cnn`                  |

| Provider  | Models                           |
| --------- | -------------------------------- |
| OpenAI    | GPT-4o, GPT-4o-mini, GPT-4 Turbo |
| Anthropic | Claude 3 Haiku, Sonnet, Opus     |
| Google    | Gemini 1.5 Flash, Gemini 1.5 Pro |

## Internal Service Bindings

The `agent-worker` requires the following bindings to operate:

- `D1_SERVICE`: To fetch open positions and system logs.
- `TRADE_SERVICE`: To execute trailing stops and profit-taking.
- `TELEGRAM_SERVICE`: To broadcast AI summaries and emergency alerts.
- `CONFIG_KV`: For dynamic configuration and state.
- `AI`: Workers AI binding for inference.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
