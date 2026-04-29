# ⚙️ Configuration Guide

> How to configure Hoox workers

## workers.jsonc

The central configuration file is `workers.jsonc`. Here's a complete example:

```jsonc
{
  // ============================================
  // GLOBAL SETTINGS
  // ============================================
  "global": {
    // Required: Cloudflare® API Token
    "cloudflare_api_token": "cfut_...",

    // Required: Your Cloudflare® Account ID
    "cloudflare_account_id": "abc123...",

    // Required: Cloudflare® Secret Store ID
    "cloudflare_secret_store_id": "your-secret-store-id",

    // Optional: Subdomain prefix (used for worker names)
    "subdomain_prefix": "cryptolinx"
  },
  // ============================================
  // WORKER CONFIGURATIONS
  // ============================================
  "workers": {
    // hoox - Gateway Worker
    "hoox": {
      "enabled": true,
      "path": "workers/hoox",
      "description": "Central webhook processing",
      "secrets": ["WEBHOOK_API_KEY", "INTERNAL_KEY"]
    },
    // trade-worker - Trading Engine
    "trade-worker": {
      "enabled": true,
      "path": "workers/trade-worker",
      "description": "Multi-exchange trading",
      "secrets": ["INTERNAL_KEY", "MEXC_API_KEY", "MEXC_API_SECRET"],
      "vars": { "DEFAULT_LEVERAGE": "20" }
    },
    // telegram-worker - Notifications
    "telegram-worker": {
      "enabled": true,
      "path": "workers/telegram-worker",
      "description": "Telegram bot & notifications",
      "secrets": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID_DEFAULT"]
    },
    // d1-worker - Database
    "d1-worker": {
      "enabled": false,
      "path": "workers/d1-worker",
      "description": "D1 database operations",
      "secrets": []
    }
  }
}
```

## Environment Variables

### In `.keys/local_keys.env`

```bash
# For local development
WEBHOOK_API_KEY_BINDING=your-generated-key
INTERNAL_KEY=internal-shared-key
TELEGRAM_BOT_TOKEN=your-bot-token
```

### In Worker `.dev.vars`

```bash
# For wrangler dev
WEBHOOK_API_KEY_BINDING=dev-key
```

## Worker Secrets

Each worker can define required secrets in `workers.jsonc`. These are prompted for during setup.

```jsonc
{
  "workers": {
    "hoox": {
      "secrets": ["WEBHOOK_API_KEY_BINDING", "INTERNAL_KEY_BINDING"]
    }
  }
}
```

Available secret types:

- `WEBHOOK_API_KEY_BINDING` - External API key for webhook validation
- `INTERNAL_KEY_BINDING` - Internal service authentication
- Exchange keys (MEXC_API_KEY, etc.)
- Telegram tokens


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
