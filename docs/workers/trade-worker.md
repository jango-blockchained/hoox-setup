# Trade Worker

**Last Updated:** April 2026

A Cloudflare® Worker service for executing cryptocurrency trades, logging signals, and potentially leveraging AI/RAG for strategy analysis. This worker interacts directly with exchange APIs, D1, R2, and potentially AI services.

## Features

- Multi-exchange support (e.g., Binance, MEXC, Bybit - depending on implemented clients).
- Secure authentication for internal requests via shared key (`INTERNAL_KEY_BINDING`).
- Direct D1 database integration for storing trade signals, history, etc. (`DB` binding).
- Direct R2 integration for storing reports or logs (`REPORTS_BUCKET` binding).
- Optional Workers AI / Vectorize integration for RAG or strategy analysis (`AI`, `VECTORIZE_INDEX` bindings).
- Position management.
- Error handling and logging.
- **Queue Consumer**: Consumes trades from `trade-execution` queue.
- **Retry Logic**: 5 attempts with exponential backoff (0s, 30s, 1m, 5m, 15m).
- **Dead Letter Handling**: Failed trades logged to D1 after max retries.

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare® Workers account
- Cloudflare® D1 Database access
- Cloudflare® R2 access
- API keys for desired exchanges.

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare® account ID in `wrangler.jsonc`.
3.  Create necessary D1 database(s) and R2 bucket(s):
    ```bash
    # Example D1 database for trade data
    npx wrangler d1 create trade-data-db
    # Example R2 bucket for reports
    npx wrangler r2 bucket create trade-reports
    ```
4.  Apply D1 schema(s):
    ```bash
    npx wrangler d1 execute trade-data-db --file=./schema.sql
    ```
5.  Configure Secrets (via Cloudflare® dashboard or `wrangler secret put`):
    - `INTERNAL_KEY_BINDING`: The **shared** secret key for internal authentication.
    - `MEXC_API_KEY`, `MEXC_API_SECRET`: If using MEXC.
    - `BINANCE_API_KEY`, `BINANCE_API_SECRET`: If using Binance.
    - `BYBIT_API_KEY`, `BYBIT_API_SECRET`: If using Bybit.
6.  Update `wrangler.jsonc` with all necessary bindings (D1, R2, KV, Secrets, AI, Vectorize). Example:
    ```jsonc
    {
      "name": "trade-worker",
      "main": "src/index.ts",
      "compatibility_date": "2025-03-07",
      "compatibility_flags": ["nodejs_compat"],
      "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "trade-data-db",
          "database_id": "<YOUR_D1_DB_ID>",
        },
      ],
      "r2_buckets": [
        { "binding": "REPORTS_BUCKET", "bucket_name": "trade-reports" },
      ],
      "kv_namespaces": [
        { "binding": "CONFIG_KV", "id": "...", "preview_id": "..." },
      ],
      "queues": {
        "consumers": [{ "queue": "trade-execution" }],
      },
      "secrets": [
        "INTERNAL_KEY_BINDING",
        "MEXC_API_KEY",
        "MEXC_API_SECRET",
        "BINANCE_API_KEY",
        "BINANCE_API_SECRET",
        "BYBIT_API_KEY",
        "BYBIT_API_SECRET"
      ],
      "observability": {
        "enabled": true,
        "head_sampling_rate": 1,
      },
    }
    ```
7.  Update the corresponding `worker-configuration.d.ts` file.
8.  For local development, create a `.dev.vars` file and define secrets/variables:
    ```.dev.vars
    # Mock secret bindings for local dev:
    INTERNAL_KEY_BINDING="your_shared_internal_secret"
    MEXC_API_KEY="your_mexc_key"
    MEXC_API_SECRET="your_mexc_secret"
    ```

## Development

Run locally:

```bash
bun run dev --local
```

Deploy:

```bash
bun run deploy
```

## API Interface

This worker primarily exposes two types of endpoints:

### 1. Internal Processing Endpoint (`/process`)

Accepts requests from authenticated internal services (like `hoox`) to perform actions like placing trades.

- **Method:** `POST`
- **Endpoint:** `/process`
- **Content-Type:** `application/json`
- **Expected Request Body:**

  ```json
  {
    "requestId": "<uuid_from_caller>",
    "internalAuthKey": "YOUR_INTERNAL_SHARED_SECRET",
    "payload": {
      "exchange": "binance",
      "action": "LONG",
      "symbol": "BTCUSDT",
      "quantity": 0.001,
      "price": 65000,
      "orderType": "MARKET",
      "leverage": 20
    }
  }
  ```

- **Response Format:**

  **Success:**

  ```json
  {
    "success": true,
    "result": { ... },
    "error": null
  }
  ```

  **Error:**

  ```json
  {
    "success": false,
    "result": null,
    "error": "<Error message>"
  }
  ```

### 2. Data API Endpoints (e.g., `/api/signals`)

Provides direct access to data stored by the worker.

- **Method:** `POST` (for creating signals), `GET` (for retrieving signals)
- **Endpoint:** `/api/signals`

## Exchange Clients

The worker uses dedicated client implementations for each supported exchange (e.g., `binance-client.ts`, `mexc-client.ts`). These handle exchange-specific API requirements.

## Database Interaction

The worker uses its `DB` binding to interact directly with the configured D1 database for storing and retrieving trade signals, history, configurations, etc.

## Security

- Internal requests to `/process` _must_ include a valid `internalAuthKey`.
- Exchange API keys/secrets are stored securely using Cloudflare® Workers Secrets.
- D1 interactions use parameterized queries to prevent SQL injection.

## Error Handling

The worker includes error handling for authentication failures, invalid parameters, exchange API errors, network issues, and database interaction failures.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
