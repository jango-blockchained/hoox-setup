---
title: "Infrastructure Bindings Index"
description: "Comprehensive registry of all Cloudflare Workers Service Bindings, KV caches, SQLite databases, Durable Objects, and Queue pipelines."
---

# 🧬 Infrastructure Bindings Index

> **📋 Canonical Reference**: For the complete, up-to-date bindings reference, see **[`docs/devops/bindings.md`](../bindings.md)**.
>
> This document provides architectural context and additional details about how bindings work in the Hoox monorepo.

In Cloudflare's serverless architecture, **bindings** represent the declarative bridges linking your isolate compute logic to other internal microservices and storage platforms. This document serves as the architectural companion to the canonical bindings reference.

---

## 1. Secrets & Environment Variables Matrix

> **See**: [`docs/devops/bindings.md#secrets--environment-variables`](../bindings.md#secrets--environment-variables) for the complete list.

These parameters represent encrypted variables injected directly into V8 execution isolates at runtime. Key secrets include:

- **`INTERNAL_KEY_BINDING`**: Cryptographic auth key used by the `requireInternalAuth` middleware to validate service-to-service calls.
- **`TG_BOT_TOKEN_BINDING`**: Secret bot token issued by `@BotFather` to authenticate Telegram API commands and alerts.
- **Exchange API Keys**: Bybit, Binance, MEXC credentials for cryptographically signed order routes.
- **`CF_API_TOKEN`**: Access token for Cloudflare Browser Rendering APIs.

---

## 2. Service Bindings (Compute Connectors)

> **See**: [`docs/devops/bindings.md#service-bindings`](../bindings.md#service-bindings) for the complete list.

Service Bindings link workers' V8 runtimes together locally in memory, with microsecond latency and zero external internet hops:

- **`TRADE_SERVICE`**: Handles leverage calculation, size scaling, and execution.
- **`TELEGRAM_SERVICE`**: Dispatches real-time alerts and parses slash commands.
- **`D1_SERVICE`**: Serves as the high-integrity proxy SQL data manager.
- **`AGENT_SERVICE`**: Triggers risk audits, chat streams, and telemetry updates.

---

## 3. KV Namespace Caches

> **See**: [`docs/devops/bindings.md#kv-namespace-bindings`](../bindings.md#kv-namespace-bindings) for the complete list.

Key-Value caches store parameters that require sub-millisecond read access:

- **`CONFIG_KV`**: Primary cache for the 16-key runtime manifest, rate-limiter, and Kill Switch.
- **`SESSIONS_KV`**: Stores active webhook session credentials and token cookie states.

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

> **See**: [`docs/devops/bindings.md#r2-bucket-bindings`](../bindings.md#r2-bucket-bindings) for the complete list.

R2 Buckets store heavy files with zero bandwidth egress retrieval fees:

- **`REPORTS_BUCKET`**: Compiled PDF daily/weekly portfolio reports.
- **`SYSTEM_LOGS_BUCKET`**: Verbose exchange API request-response logs.
- **`UPLOADS_BUCKET`**: User chart screenshots and conversation images.

---

## 7. D1 SQLite Databases

> **See**: [`docs/devops/bindings.md#d1-database-bindings`](../bindings.md#d1-database-bindings) for the complete list.

| Binding Name | Bound Workers | Database Instance Name | Purpose                                       |
| :----------- | :------------ | :--------------------- | :-------------------------------------------- |
| `DB`         | `d1-worker`   | `trade-data-db`        | Primary transactional trade database storage. |

---

## 8. Workers AI & Vectorize Indexes

> **See**: [`docs/devops/bindings.md#ai-bindings`](../bindings.md#ai-bindings) and [`docs/devops/bindings.md#vectorize-bindings`](../bindings.md#vectorize-bindings) for the complete list.

| Binding Name      | Bound Workers                                             | Target Asset Name | Operational Purpose                               |
| :---------------- | :-------------------------------------------------------- | :---------------- | :------------------------------------------------ |
| `AI`              | `hoox`, `trade-worker`, `agent-worker`, `telegram-worker` | Edge LLM Models   | Runs LLaMA-3 inference, risk analysis, and chat.  |
| `VECTORIZE_INDEX` | `telegram-worker`                                         | `rag-index`       | Custom semantic search vector DB for RAG queries. |

---

## 🌐 9. Puppeteer Browser Rendering

> **See**: [`docs/devops/bindings.md#browser-rendering`](../bindings.md#browser-rendering) for the complete details.

The `report-worker` invokes Cloudflare's Browser Rendering Chrome isolates using a secure **REST API** (no binding required):

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

- **[Canonical Bindings Reference](../bindings.md)** — Complete, up-to-date bindings table.
- **[Storage & SQLite DDL](storage.md)** — Dive into Drizzle schemas, R2 bucket configurations, and database rules.
- **[Production Deployments](../deployment/production.md)** — Learn how Wrangler compiles and maps these bindings to the live edge.
