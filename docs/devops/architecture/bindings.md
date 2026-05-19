---
title: "Cloudflare® Workers Bindings & Environment Variables"
---

# Cloudflare® Workers Bindings & Environment Variables

This document provides a comprehensive reference for all bindings, environment variables, and secrets used in the Cloudflare® Workers project.

## Table of Contents

- [Secrets & Environment Variables](#secrets--environment-variables)
- [Service Bindings](#service-bindings)
- [KV Namespace Bindings](#kv-namespace-bindings)
- [Queue Bindings](#queue-bindings)
- [Durable Object Bindings](#durable-object-bindings)
- [R2 Bucket Bindings](#r2-bucket-bindings)
- [D1 Database Bindings](#d1-database-bindings)
- [AI Bindings](#ai-bindings)
- [Vectorize Bindings](#vectorize-bindings)
- [Browser Bindings](#browser-bindings)

## Secrets & Environment Variables

| Variable                  | Type   | Workers                             | Description                                                |
| ------------------------- | ------ | ----------------------------------- | ---------------------------------------------------------- |
| `INTERNAL_KEY_BINDING`    | Secret | telegram-worker, hoox, trade-worker | Internal auth key for worker-to-worker communication       |
| `TG_BOT_TOKEN_BINDING`    | Secret | telegram-worker                     | Telegram Bot API token                                     |
| `TG_CHAT_ID_BINDING`      | Secret | telegram-worker                     | Telegram chat ID for notifications                         |
| `TELEGRAM_SECRET_TOKEN`   | Secret | telegram-worker                     | Webhook verification token for Telegram                    |
| `WEBHOOK_API_KEY_BINDING` | Secret | hoox                                | API key for webhook endpoints                              |
| `CF_API_TOKEN_BINDING`    | Secret | report-worker                       | CF API token with Browser Rendering + R2 write permissions |
| `MEXC_KEY_BINDING`        | Secret | trade-worker                        | MEXC exchange API key                                      |
| `MEXC_SECRET_BINDING`     | Secret | trade-worker                        | MEXC exchange API secret                                   |
| `BINANCE_KEY_BINDING`     | Secret | trade-worker                        | Binance exchange API key                                   |
| `BINANCE_SECRET_BINDING`  | Secret | trade-worker                        | Binance exchange API secret                                |
| `BYBIT_KEY_BINDING`       | Secret | trade-worker                        | Bybit exchange API key                                     |
| `BYBIT_SECRET_BINDING`    | Secret | trade-worker                        | Bybit exchange API secret                                  |

## Service Bindings

| Binding            | Worker                                  | Connected Service | Description           |
| ------------------ | --------------------------------------- | ----------------- | --------------------- |
| `TRADE_SERVICE`    | hoox, agent, email                      | trade-worker      | Trading functionality |
| `TELEGRAM_SERVICE` | hoox, trade, agent, web3-wallet, report | telegram-worker   | Notifications         |
| `D1_SERVICE`       | trade, agent, report, dashboard         | d1-worker         | Database operations   |
| `AGENT_SERVICE`    | dashboard                               | agent-worker      | AI risk management    |

## KV Namespace Bindings

| Binding       | Worker                                             | Description                           |
| ------------- | -------------------------------------------------- | ------------------------------------- |
| `CONFIG_KV`   | hoox, trade, agent, telegram, d1, dashboard, email | Routing, IP lists, rate limiter state |
| `SESSIONS_KV` | hoox                                               | Webhook session storage               |

## Queue Bindings

| Binding       | Worker       | Queue Name      | Type     | Description                          |
| ------------- | ------------ | --------------- | -------- | ------------------------------------ |
| `TRADE_QUEUE` | hoox         | trade-execution | Producer | Sends trades for async processing    |
| `TRADE_QUEUE` | trade-worker | trade-execution | Consumer | Receives and processes queued trades |

## Durable Object Bindings

| Binding             | Worker | Class Name       | Description                                   |
| ------------------- | ------ | ---------------- | --------------------------------------------- |
| `IDEMPOTENCY_STORE` | hoox   | IdempotencyStore | Real DO with SQLite, TTL dedup, alarm cleanup |

## R2 Bucket Bindings

| Binding              | Worker          | Bucket Name      | Description           |
| -------------------- | --------------- | ---------------- | --------------------- |
| `REPORTS_BUCKET`     | trade-worker    | trade-reports    | Trade reports         |
| `REPORTS_BUCKET`     | report-worker   | trade-reports    | PDF portfolio reports |
| `SYSTEM_LOGS_BUCKET` | trade-worker    | hoox-system-logs | Verbose exchange logs |
| `UPLOADS_BUCKET`     | telegram-worker | user-uploads     | User uploaded files   |

## D1 Database Bindings

| Binding | Worker       | Database Name   | Description       |
| ------- | ------------ | --------------- | ----------------- |
| `DB`    | d1-worker    | hoox-trading-db | Main database     |
| `DB`    | trade-worker | trade-data-db   | Trade operations  |
| `DB`    | agent-worker | hoox-trading-db | Portfolio queries |

## AI Bindings

| Binding | Worker                              | Description                    |
| ------- | ----------------------------------- | ------------------------------ |
| `AI`    | hoox, agent, telegram, trade-worker | Workers AI (LLaMA 3 inference) |

## Vectorize Bindings

| Binding           | Worker                       | Index Name   | Description                          |
| ----------------- | ---------------------------- | ------------ | ------------------------------------ |
| `VECTORIZE_INDEX` | hoox, telegram, trade-worker | my-rag-index | Vector database for RAG applications |

## Browser Rendering

Report-worker uses the Cloudflare Browser Rendering **REST API** (no binding needed):

```
POST https://api.cloudflare.com/client/v4/accounts/{id}/browser-rendering/pdf
Authorization: Bearer {CF_API_TOKEN}
Body: { html: "...", options: { format: "A4" } }
```

## Local Development Ports

For `wrangler dev` or Docker Compose:

| Worker             | Port |
| ------------------ | ---- |
| hoox (Gateway)     | 8787 |
| trade-worker       | 8789 |
| telegram-worker    | 8791 |
| d1-worker          | 8792 |
| web3-wallet-worker | 8793 |
| dashboard          | 8794 |
| agent-worker       | 8795 |
| email-worker       | 8796 |
| report-worker      | 8797 |

## Configuration

Each worker contains a `.dev.vars` file for local development which should be populated with the appropriate values. These files should not be committed to the repository.

Example setup for `.dev.vars` files can be found in the corresponding `.dev.vars.example` files in each worker directory.

## Setting Up Secrets

For production deployment, secrets should be set using the Wrangler CLI:

```bash
wrangler secret put SECRET_NAME
```

This will securely store the secret and make it available to the worker at runtime.

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._
