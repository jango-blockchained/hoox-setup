# 🎯 Quick Start Guide

> Get up and running with Hoox in 5 minutes

## Prerequisites

- Bun ≥1.2
- Cloudflare® account
- Wrangler CLI (`npm install -g wrangler`)

## Step 1: Clone & Install

### Option A: Install via CLI (Recommended)

```bash
# 1. Install the CLI globally
bun add -g @jango-blockchained/hoox-cli

# 2. Bootstrap the complete repository
hoox clone hoox-setup
cd hoox-setup

# 3. Install dependencies
bun install
```

### Option B: Install from Source

```bash
# 1. Clone the repository
git clone --recursive https://github.com/jango-blockchained/hoox-setup.git hoox-setup
cd hoox-setup

# 2. Install dependencies
bun install
```

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

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
