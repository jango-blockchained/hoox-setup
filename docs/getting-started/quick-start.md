---
title: "Quick Start"
description: "Send your first trade in 5 minutes"
---

# Quick Start

> Get from zero to a deployed trading system in 5 minutes.

## Prerequisites

- Hoox CLI installed ([Installation](installation.md))
- Cloudflare account
- Exchange API keys (Binance, Bybit, or MEXC)

## Step 1: Initialize

```bash
hoox init
```

Follow the prompts:
- Enter your Cloudflare Account ID
- Paste your API Token
- Choose a subdomain prefix (e.g., `mytrading`)
- Select which workers to enable

## Step 2: Set Up Exchange Keys

```bash
hoox secrets update-cf BINANCE_API_KEY trade-worker
hoox secrets update-cf BINANCE_API_SECRET trade-worker
```

(Repeat for MEXC or Bybit keys as needed.)

## Step 3: Deploy

```bash
hoox deploy all
```

This deploys all enabled workers to Cloudflare in the correct dependency order.

## Step 4: Send a Test Trade

```bash
curl -X POST https://hoox.your-prefix.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-api-key",
    "exchange": "mexc",
    "action": "LONG",
    "symbol": "BTC_USDT",
    "quantity": 0.01
  }'
```

## Expected Response

```json
{
  "success": true,
  "requestId": "uuid-here",
  "result": {
    "orderId": "order-id"
  }
}
```

## Next Steps

- [How Hoox Works](../concepts/how-hoox-works.md) — Understand the architecture
- [Configuration](configuration.md) — Customize your setup
- [Monitoring Guide](../guides/monitor-trading.md) — Watch your trades
