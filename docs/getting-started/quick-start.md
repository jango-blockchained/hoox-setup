---
title: "🎯 Quick Start Guide"
description: "Get up and running with Hoox in 5 minutes"
---
# 🎯 Quick Start Guide

> Get up and running with Hoox in 5 minutes

## Prerequisites

- Bun ≥1.2
- Cloudflare® account
- Wrangler CLI (`npm install -g wrangler`)

## Step 1: Clone & Install

All 9 workers are managed as Git submodules. Clone with `--recursive` to get everything:

```bash
# Clone with all submodules
git clone --recursive https://github.com/jango-blockchained/hoox-setup.git
cd hoox-setup

# Install dependencies
bun install

# If you already cloned without --recursive:
git submodule update --init --recursive
```

> **Tip:** Run `bun run typecheck` after install to verify everything compiles.

## Step 2: Initialize

```bash
hoox config setup
hoox init
```

Follow the wizard prompts:

1. ✅ Check dependencies
2. 👤 Enter Cloudflare® Account ID
3. 🔑 Enter API Token
4. 🔤 Enter subdomain prefix (e.g., `myapp`)
5. 📦 Select workers to enable

## Step 3: Configure API Key

```bash
# Generate or use your own key
echo "YOUR_API_KEY" > .keys/local_keys.env

# Upload to Cloudflare®
hoox secrets update-cf WEBHOOK_API_KEY_BINDING hoox
```

## Step 4: Deploy

```bash
hoox workers deploy
```

## Step 5: Test

Send a test webhook:

```bash
curl -X POST https://hoox.cryptolinx.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
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

## What's Next?

- [Architecture Overview](../architecture/overview.md)
- [Worker Details](../workers/hoox.md)
- [API Reference](../api/endpoints.md)

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._
