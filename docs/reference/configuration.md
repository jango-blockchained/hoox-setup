---
title: "Configuration Reference"
description: "All environment variables, KV keys, and manifests"
---

# Configuration Reference

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token with Worker permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Your Cloudflare account ID |
| `SUBDOMAIN_PREFIX` | Yes | Prefix for worker subdomains |

See `.env.example` for the full list of 31+ variables including optional Telegram, AI provider, exchange, email, and wallet keys.

## KV Configuration Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trade:kill_switch` | boolean | false | Emergency halt all trading |
| `trade:max_daily_drawdown_percent` | number | 10 | Max loss before auto-stop |
| `webhook:tradingview:ip_check_enabled` | boolean | false | Validate TradingView IPs |
| `routing:dynamic:enabled` | boolean | false | Dynamic exchange routing |

> **Full reference:** [Environment Matrix](../devops/setup_and_operations.md#3-complete-environment-matrix) | [KV Keys](../devops/setup_and_operations.md#33-kv-configuration-keys) | [Getting Started Config](../getting-started/configuration.md)
