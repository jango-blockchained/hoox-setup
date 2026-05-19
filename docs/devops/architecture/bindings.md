---
title: "Infrastructure Bindings Index"
description: "Comprehensive registry of all Cloudflare Workers Service Bindings, KV caches, SQLite databases, Durable Objects, and Queue pipelines."
---

# 🧬 Infrastructure Bindings Index

In Cloudflare’s serverless architecture, **bindings** represent the declarative bridges linking your isolate compute logic to other internal microservices and storage platforms. This document serves as the absolute, production-grade reference registry for all resource bindings configured in the Hoox monorepo.

---

## 1. Secrets & Environment Variables Matrix

These parameters represent encrypted variables injected directly into V8 execution isolates at runtime.

| Variable Name                 |  Type  | Bound Workers                                                          | Operational Impact                                                                                        |
| :---------------------------- | :----: | :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| `INTERNAL_KEY_BINDING`        | Secret | `hoox`, `trade-worker`, `d1-worker`, `telegram-worker`, `email-worker` | Cryptographic auth key used by the `requireInternalAuth` middleware to validate service-to-service calls. |
| `TG_BOT_TOKEN_BINDING`        | Secret | `telegram-worker`                                                      | Secret bot token issued by `@BotFather` to authenticate Telegram API commands and alerts.                 |
| `TELEGRAM_SECRET_TOKEN`       | Secret | `telegram-worker`                                                      | Webhook verification token to authorize Telegram push events.                                             |
| `WEBHOOK_API_KEY`             | Secret | `hoox`                                                                 | General passkey validated during incoming webhook signal requests.                                        |
| `BYBIT_API_KEY` / `_SECRET`   | Secret | `trade-worker`                                                         | Credentials used to execute cryptographically signed order routes to Bybit's APIs.                        |
| `BINANCE_API_KEY` / `_SECRET` | Secret | `trade-worker`                                                         | Credentials used to execute trade routes to Binance's APIs.                                               |
| `MEXC_API_KEY` / `_SECRET`    | Secret | `trade-worker`                                                         | Credentials used to execute trade routes to MEXC's APIs.                                                  |
| `CF_API_TOKEN`                | Secret | `report-worker`                                                        | Access token used to invoke the Cloudflare Puppeteer Browser Rendering APIs.                              |

---

## 2. Service Bindings (Compute Connectors)

Service Bindings link workers' V8 runtimes together locally in memory, with microsecond latency and zero external internet hops.

| Binding Name       | Ingesting Worker                                             | Target Service    | Purpose                                                    |
| :----------------- | :----------------------------------------------------------- | :---------------- | :--------------------------------------------------------- |
| `TRADE_SERVICE`    | `hoox`, `agent-worker`, `email-worker`                       | `trade-worker`    | Handles leverage calculation, size scaling, and execution. |
| `TELEGRAM_SERVICE` | `hoox`, `trade-worker`, `agent-worker`, `report-worker`      | `telegram-worker` | Dispatches real-time alerts and parses slash commands.     |
| `D1_SERVICE`       | `trade-worker`, `agent-worker`, `report-worker`, `dashboard` | `d1-worker`       | Serves as the high-integrity proxy SQL data manager.       |
| `AGENT_SERVICE`    | `dashboard`                                                  | `agent-worker`    | Triggers risk audits, chat streams, and telemetry updates. |

---

## 3. KV Namespace Caches

Key-Value caches store parameters that require sub-millisecond read access.

| Binding Name  | Bound Workers               | Purpose                                                                       |
| :------------ | :-------------------------- | :---------------------------------------------------------------------------- |
| `CONFIG_KV`   | **All Workers** + Dashboard | Primary cache for the 16-key runtime manifest, rate-limiter, and Kill Switch. |
| `SESSIONS_KV` | `hoox` Gateway              | Stores active webhook session credentials and token cookie states.            |

---

## 4. Asynchronous Queues

Queues guarantee message delivery during times of heavy exchange network congestion or API rate limits.

| Binding Name  | Ingesting Worker |    Queue Name     |     Type     | Operational Action                                          |
| :------------ | :--------------- | :---------------: | :----------: | :---------------------------------------------------------- |
| `TRADE_QUEUE` | `hoox` Gateway   | `trade-execution` | **Producer** | Serializes and enqueues signal payloads during failover.    |
| `TRADE_QUEUE` | `trade-worker`   | `trade-execution` | **Consumer** | Pulls enqueued signals and retries executions with backoff. |

---

## 5. SQLite-Backed Durable Objects

Durable Objects enforce exactly-once execution, preventing catastrophic double-trading.

| Binding Name        | Bound Worker   | Target Class Name  | Purpose                                                                   |
| :------------------ | :------------- | :----------------- | :------------------------------------------------------------------------ |
| `IDEMPOTENCY_STORE` | `hoox` Gateway | `IdempotencyStore` | Mutex locking engine with local SQLite and auto-alarm garbage collection. |

---

## 6. R2 Object Storage Buckets

R2 Buckets store heavy files with zero bandwidth egress retrieval fees.

| Binding Name         | Bound Workers                   | Bucket Name        | Target Asset Payload                            |
| :------------------- | :------------------------------ | :----------------- | :---------------------------------------------- |
| `REPORTS_BUCKET`     | `trade-worker`, `report-worker` | `trade-reports`    | Compiled PDF daily/weekly portfolio reports.    |
| `SYSTEM_LOGS_BUCKET` | `trade-worker`                  | `hoox-system-logs` | Verbose exchange API request-response logs.     |
| `UPLOADS_BUCKET`     | `telegram-worker`               | `user-uploads`     | User chart screenshots and conversation images. |

---

## 7. D1 SQLite Databases

| Binding Name | Bound Workers | Database Instance Name | Purpose                                       |
| :----------- | :------------ | :--------------------- | :-------------------------------------------- |
| `DB`         | `d1-worker`   | `trade-data-db`        | Primary transactional trade database storage. |

---

## 8. Workers AI & Vectorize Indexes

| Binding Name      | Bound Workers                                             | Target Asset Name | Operational Purpose                               |
| :---------------- | :-------------------------------------------------------- | :---------------- | :------------------------------------------------ |
| `AI`              | `hoox`, `trade-worker`, `agent-worker`, `telegram-worker` | Edge LLM Models   | Runs LLaMA-3 inference, risk analysis, and chat.  |
| `VECTORIZE_INDEX` | `telegram-worker`                                         | `rag-index`       | Custom semantic search vector DB for RAG queries. |

---

## 🌐 9. Puppeteer Browser Rendering

The `report-worker` invokes Cloudflare’s Browser Rendering Chrome isolates using a secure **REST API** (no binding required):

- **Route**: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/pdf`
- **Headers**:
  ```http
  Authorization: Bearer <CF_API_TOKEN_BINDING>
  Content-Type: application/json
  ```
- **JSON Payload**:
  ```json
  {
    "html": "<html>...</html>",
    "options": {
      "format": "A4",
      "printBackground": true
    }
  }
  ```

---

> **Tip:** Adding new bindings to your workers? Always update your `wrangler.jsonc` manifest at the workspace root, and then execute `hoox deploy update-internal-urls` to sync bindings and URLs globally!

### 🔗 Next Steps

- **[Storage & SQLite DDL](storage.md)** — Dive into Drizzle schemas, R2 bucket configurations, and database rules.
- **[Production Deployments](../deployment/production.md)** — Learn how Wrangler compiles and maps these bindings to the live edge.
