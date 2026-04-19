# Cloudflare Workers Bindings & Environment Variables

This document provides a comprehensive reference for all bindings, environment variables, and secrets used in the Cloudflare Workers project.

## Table of Contents

- [Secrets & Environment Variables](#secrets--environment-variables)
- [Service Bindings](#service-bindings)
- [KV Namespace Bindings](#kv-namespace-bindings)
- [R2 Bucket Bindings](#r2-bucket-bindings)
- [D1 Database Bindings](#d1-database-bindings)
- [AI Bindings](#ai-bindings)
- [Vectorize Bindings](#vectorize-bindings)
- [Browser Bindings](#browser-bindings)

## Secrets & Environment Variables

| Variable | Type | Workers | Description |
|----------|------|---------|-------------|
| `INTERNAL_KEY_BINDING` | Secret | telegram-worker, hoox, trade-worker | Internal authentication key for worker-to-worker communication |
| `TG_BOT_TOKEN_BINDING` | Secret | telegram-worker | Telegram Bot API token |
| `TG_CHAT_ID_BINDING` | Secret | telegram-worker | Telegram chat ID for notifications |
| `TELEGRAM_SECRET_TOKEN` | Secret | telegram-worker | Webhook verification token for Telegram |
| `WEBHOOK_API_KEY_BINDING` | Secret | hoox | API key for webhook endpoints |
| `ADMIN_API_KEY_BINDING` | Secret | hoox | Admin API authentication key |
| `HA_TOKEN_BINDING` | Secret | hoox | Home Assistant authentication token |
| `WALLET_PK_SECRET` | Secret | web3-wallet-worker | Private key for Web3 wallet operations |
| `WALLET_MNEMONIC_SECRET` | Secret | web3-wallet-worker | Mnemonic phrase for wallet generation |
| `MEXC_KEY_BINDING` | Secret | trade-worker | MEXC exchange API key |
| `MEXC_SECRET_BINDING` | Secret | trade-worker | MEXC exchange API secret |
| `BINANCE_KEY_BINDING` | Secret | trade-worker | Binance exchange API key |
| `BINANCE_SECRET_BINDING` | Secret | trade-worker | Binance exchange API secret |
| `BYBIT_KEY_BINDING` | Secret | trade-worker | Bybit exchange API key |
| `BYBIT_SECRET_BINDING` | Secret | trade-worker | Bybit exchange API secret |
| `UNISWAP_API_KEY_BINDING` | Secret | trade-worker | Uniswap API key |
| `WEB3_RPC_URL_BINDING` | Secret | trade-worker | Web3 RPC URL for blockchain interactions |

## Service Bindings

| Binding | Worker | Connected Service | Description |
|---------|--------|------------------|-------------|
| `TRADE_SERVICE` | telegram-worker | trade-worker | Access to trading functionality |
| `WEBHOOK_RECEIVER_API` | telegram-worker | hoox | Access to webhook handling |
| `WEB3_WALLET_API` | telegram-worker | web3-wallet-worker | Access to wallet functionality |
| `TRADE_SERVICE` | hoox | trade-worker | Access to trading functionality |
| `TELEGRAM_SERVICE` | hoox | telegram-worker | Access to Telegram notification service |
| `HOME_ASSISTANT_SERVICE` | hoox | home-assistant-worker | Access to Home Assistant service |
| `TELEGRAM_SERVICE` | trade-worker, web3-wallet-worker | telegram-worker | Access to Telegram notification service |
| `D1_SERVICE` | trade-worker | d1-worker | Access to D1 database service |
| `WEB3_WALLET_WORKER` | trade-worker | web3-wallet-worker | Access to wallet functionality |

## KV Namespace Bindings

| Binding | Worker | Description |
|---------|--------|-------------|
| `CONFIG_KV` | telegram-worker, trade-worker | Store configuration data |
| `SESSIONS_KV` | hoox | Store session data |
| `CONFIG_KV` | hoox | Store configuration data |

## R2 Bucket Bindings

| Binding | Worker | Bucket Name | Description |
|---------|--------|-------------|-------------|
| `UPLOADS_BUCKET` | telegram-worker | user-uploads | Store user uploaded files |
| `REPORTS_BUCKET` | trade-worker | trade-reports | Store trading reports and data |

## D1 Database Bindings

| Binding | Worker | Database Name | Description |
|---------|--------|---------------|-------------|
| `DB` | d1-worker | hoox-trading-db | Main database for trading data |
| `DB` | trade-worker | trade-data-db | Database for trade operations |

## AI Bindings

| Binding | Worker | Description |
|---------|--------|-------------|
| `AI` | telegram-worker, hoox, trade-worker | Access to Cloudflare Workers AI capabilities |

## Vectorize Bindings

| Binding | Worker | Index Name | Description |
|---------|--------|------------|-------------|
| `VECTORIZE_INDEX` | telegram-worker, hoox, trade-worker | my-rag-index | Vector database for RAG applications |

## Browser Bindings

| Binding | Worker | Description |
|---------|--------|-------------|
| `BROWSER` | web3-wallet-worker, trade-worker | Access to browser rendering capabilities |

## Local Development URLs

For local development with `wrangler dev`, the following service URLs are used:

| Service | Local URL | Used By |
|---------|-----------|---------|
| D1 Worker | http://localhost:8789 | trade-worker |
| Telegram Worker | http://localhost:8790 | hoox, trade-worker, web3-wallet-worker |
| Web3 Wallet Worker | http://localhost:8792 | trade-worker |
| Trade Worker | http://localhost:8788 | hoox |
| Home Assistant Worker | http://localhost:8791 | hoox |

## Configuration

Each worker contains a `.dev.vars` file for local development which should be populated with the appropriate values. These files should not be committed to the repository.

Example setup for `.dev.vars` files can be found in the corresponding `.dev.vars.example` files in each worker directory.

## Setting Up Secrets

For production deployment, secrets should be set using the Wrangler CLI:

```bash
wrangler secret put SECRET_NAME
```

This will securely store the secret and make it available to the worker at runtime. 