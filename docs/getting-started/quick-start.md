# 🎯 Quick Start Guide

> Get up and running with Hoox in 5 minutes

## Prerequisites

- Bun ≥1.2
- Cloudflare® account
- Wrangler CLI (`npm install -g wrangler`)

## Step 1: Clone & Install

```bash
git clone --recurse-submodules https://github.com/jango-blockchained/hoox-setup.git
cd hoox-setup
bun install
```

## Step 2: Initialize

```bash
bun run scripts/manage.ts init
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
bun run scripts/manage.ts secrets update-cf WEBHOOK_API_KEY hoox
```

## Step 4: Deploy

```bash
bun run scripts/manage.ts workers deploy
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

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
