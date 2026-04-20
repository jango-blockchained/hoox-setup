# ⚙️ Configuration Guide

> How to configure Hoox workers

## config.toml

The central configuration file is `config.toml`. Here's a complete example:

```toml
# ============================================
# GLOBAL SETTINGS
# ============================================
[global]
# Required: Cloudflare® API Token
cloudflare_api_token = "cfut_..."

# Required: Your Cloudflare® Account ID
cloudflare_account_id = "abc123..."

# Optional: Subdomain prefix (used for worker names)
subdomain_prefix = "cryptolinx"

# Optional: Path to .env file for additional env vars
# dotenv_path = ".env"

# ============================================
# WORKER CONFIGURATIONS
# ============================================

# --------------------------------------------
# hoox - Gateway Worker
# --------------------------------------------
[workers.hoox]
enabled = true
path = "workers/hoox"
description = "Central webhook processing"
secrets = ["WEBHOOK_API_KEY", "INTERNAL_KEY"]
# vars = { }

# --------------------------------------------
# trade-worker - Trading Engine
# --------------------------------------------
[workers.trade-worker]
enabled = true
path = "workers/trade-worker"
description = "Multi-exchange trading"
secrets = [
  "INTERNAL_KEY",
  "MEXC_API_KEY",
  "MEXC_API_SECRET"
]
vars = { DEFAULT_LEVERAGE = "20" }
# deployed_url = "https://trade-worker.your-subdomain.workers.dev"

# --------------------------------------------
# telegram-worker - Notifications
# --------------------------------------------
[workers.telegram-worker]
enabled = true
path = "workers/telegram-worker"
description = "Telegram bot & notifications"
secrets = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID_DEFAULT"
]

# --------------------------------------------
# d1-worker - Database
# --------------------------------------------
[workers.d1-worker]
enabled = false
path = "workers/d1-worker"
description = "D1 database operations"
secrets = []

# --------------------------------------------
# home-assistant-worker
# --------------------------------------------
[workers.home-assistant]
enabled = false
path = "workers/home-assistant-worker"
description = "Home Assistant integration"
secrets = ["HA_TOKEN", "HA_SECURE_URL"]
```

## Environment Variables

### In `.keys/local_keys.env`

```bash
# For local development
WEBHOOK_API_KEY=your-generated-key
INTERNAL_KEY=internal-shared-key
TELEGRAM_BOT_TOKEN=your-bot-token
```

### In Worker `.dev.vars`

```bash
# For wrangler dev
WEBHOOK_API_KEY=dev-key
```

## Worker Secrets

Each worker can define required secrets in `config.toml`. These are prompted for during setup.

```toml
[workers.hoox]
secrets = ["WEBHOOK_API_KEY", "INTERNAL_KEY"]
```

Available secret types:

- `WEBHOOK_API_KEY` - External API key for webhook validation
- `INTERNAL_KEY` - Internal service authentication
- Exchange keys (MEXC_API_KEY, etc.)
- Telegram tokens
- Home Assistant tokens

## KV Configuration

Configure KV settings via the `/admin/ui` or directly in KV:

| Key                                    | Type   | Description             |
| -------------------------------------- | ------ | ----------------------- |
| `webhook:tradingview:ip_check_enabled` | string | Enable IP allow-listing |
| `webhook:allowed_ips`                  | string | Comma-separated IPs     |
| `routing:dynamic:enabled`              | string | Enable dynamic routing  |

## Next Steps

- [Architecture Overview](../architecture/overview.md)
- [Worker Details](../workers/hoox.md)


---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
