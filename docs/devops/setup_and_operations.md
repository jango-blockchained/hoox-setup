---
title: "Operations & Runbook"
description: "Master DevOps operations manual, 31-key environment variable matrices, deployment sequences, secret management, and system recovery runbooks."
---

# 📖 Operations & Runbook

This manual is the primary, production-grade operations runbook for Hoox administrators. It outlines the complete system topology, toolchain prerequisites, environment variables, sequential deployment protocols, and guided troubleshooting matrices.

---

## 1. Complete Environment Variables Matrix (31 Keys)

These variables are defined in `.env.local` for local building/deploying or injected as encrypted **Workers Secrets** for runtime isolate compute.

### A. Core Platform & Infrastructure

- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token with Workers, D1, and KV read/write permissions.
- `CLOUDFLARE_ACCOUNT_ID`: Your unique 32-character Cloudflare dashboard account hash.
- `SUBDOMAIN_PREFIX`: Subdomain prefix under which your public gateway routes compile.
- `NODE_ENV`: Target environment profile: `development`, `staging`, or `production`.
- `HOOX_API_URL`: Local API target URL (automatically configured during dev runs).

### B. Exchange API Credentials (Encrypted Secrets)

- `BYBIT_API_KEY` & `BYBIT_API_SECRET`: Bybit order placement account key and HMAC-SHA256 signature key.
- `BINANCE_API_KEY` & `BINANCE_API_SECRET`: Binance trade permission key and private HMAC signature.
- `MEXC_API_KEY` & `MEXC_API_SECRET`: MEXC trade permission key and private HMAC signature.

### C. Telegram Bot Alerts & Telemetry

- `TELEGRAM_BOT_TOKEN`: Telegram bot token from `@BotFather`.
- `TELEGRAM_CHAT_ID`: Authorized numeric Chat ID for pushed fills and commands.

### D. Multi-Provider AI Credentials

- `OPENAI_API_KEY`: OpenAI API access key.
- `ANTHROPIC_API_KEY`: Anthropic Claude API access key.
- `GOOGLE_AI_API_KEY`: Google Gemini API access key.

### E. DeFi & Web3 Wallet Settings

- `ETH_MNEMONIC`: Secure 12 or 24-word seed phrase for EVM swaps.
- `RPC_PROVIDER_URL`: HTTP Ethereum / EVM JSON-RPC provider (e.g. Infura/Alchemy).

### F. Email Parsing Inbox Connection

- `EMAIL_HOST`: POP3/IMAP mailbox server address.
- `EMAIL_USER`: Target signal mailbox email address.
- `EMAIL_PASS`: Secure app password for mailbox access.

---

## 2. Worker Deployment Sequence

Because Hoox microservices communicate internally using fast-path **Service Bindings**, they have strict compile-time and deploy-time dependencies. Deploy workers in the following strict sequential hierarchy:

```
1. analytics-worker    (No dependencies)
2. report-worker       (Depends on: analytics-worker)
3. d1-worker           (Depends on: analytics-worker)
4. telegram-worker     (Depends on: trade-worker, hoox, analytics-worker)
5. web3-wallet-worker  (Depends on: telegram-worker, analytics-worker)
6. email-worker        (Depends on: trade-worker, analytics-worker)
7. trade-worker        (Depends on: d1-worker, telegram-worker, analytics-worker)
8. agent-worker        (Depends on: d1-worker, trade-worker, telegram-worker, analytics-worker)
9. hoox Gateway        (Depends on: trade-worker, telegram-worker, analytics-worker)
10. dashboard          (Depends on: all services being live)
```

```bash
# Automated Sequenced Deployment via CLI
hoox deploy all --auto

# Or deploy a single specific worker
hoox deploy worker trade-worker
```

---

## 3. Secret Management Runbook

Secrets are securely uploaded to Cloudflare's hardware key vaults using the CLI:

```bash
# Inject Bybit Credentials
hoox secrets set BYBIT_API_KEY "your_bybit_key"
hoox secrets set BYBIT_API_SECRET "your_bybit_secret"

# Check active secret synchronization on Cloudflare
hoox secrets check
```

---

## 🚨 4. Global Kill Switch & Emergency Operations

The **Global Kill Switch** is your emergency brake. Stored inside the sub-millisecond `CONFIG_KV` namespace, flipping this parameter instantly blocks all incoming trade signals globally in under 10 seconds:

```bash
# View active state of the Kill Switch
hoox monitor kill-switch show

# Emergency HALT - disable all trade execution immediately
hoox monitor kill-switch on

# Resume normal operations
hoox monitor kill-switch off
```

---

## 🛠️ 5. Troubleshooting & Diagnostics

### Alt Alternate Screen Buffer Cleanup

If you force-close the terminal and find that your prompt remains garbled, execute a terminal reset:

```bash
reset
# or
tput reset
```

### 502 Bad Gateway

- **Root Cause**: Service binding target is missing or has crashed.
- **Fix**: Ensure the dependency worker (e.g. `trade-worker`) has been deployed successfully. Run `hoox deploy all` to rebuild all bonds.

### 503 Service Unavailable

- **Root Cause**: The Global Kill Switch is active in KV.
- **Fix**: Verify switch state: `hoox monitor kill-switch show`. If safe, restore trading: `hoox monitor kill-switch off`.

### 🔗 Next Steps

- **[Astro Docs Site Config](../getting-started/configuration.md)** — Map out your build-time environment configurations.
- **[Architecture & Edge Topology](architecture/overview.md)** — In-depth architectural outlines and Service Bindings routing maps.
