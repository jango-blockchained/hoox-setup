# Hoox Gateway Worker

**Last Updated:** April 2026

A Cloudflare® Worker service that acts as the **primary gateway** for external requests (e.g., TradingView alerts, UI actions). This worker validates incoming requests, optionally performs security checks (like IP allow-listing), and forwards them to the appropriate internal worker services using Cloudflare® Service Bindings.

## Features

- Acts as a single entry point for various external triggers.
- Validates external API keys (`apiKey` field).
- Optional IP address allow-listing (checks `CF-Connecting-IP` header, configurable via KV).
- Determines the target internal worker based on the request payload's `target` field.
- Forwards requests to internal workers using **Service Bindings** (defined in `wrangler.jsonc`).
- Returns responses from internal workers, wrapped with gateway context.
- **Queue Producer**: Sends trades to `trade-execution` queue for async processing.
- **Queue Modes**: `queue_failover` (default) or `queue_everywhere` (configurable via KV).
- **Idempotency**: Prevents duplicate trades using Durable Objects.
- **Rate Limiting**: In-memory rate limiting (10 trades/minute).

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare® account ID in `wrangler.jsonc`.
3.  Configure Secrets (via Cloudflare® dashboard or `wrangler secret put`):
    - `WEBHOOK_API_KEY_BINDING`: The secret key expected in the `apiKey` field of incoming external requests.
    - `INTERNAL_KEY_BINDING`: A shared secret key used for authentication _between_ this worker and the target workers it calls via service bindings. The target workers must also have this secret configured.
4.  Configure KV Namespaces (if using configurable features like IP allow-listing):
    ```bash
    npx wrangler kv:namespace create CONFIG_KV
    ```
5.  Update `wrangler.jsonc` with necessary bindings (Secrets, KV, Service Bindings). Example:
    ```jsonc
    {
      "name": "hoox",
      "main": "src/index.ts",
      "compatibility_date": "2025-03-07",
      "compatibility_flags": ["nodejs_compat"],
      "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
      "secrets": [
        "WEBHOOK_API_KEY_BINDING",
        "INTERNAL_KEY_BINDING"
      ],
      "kv_namespaces": [
        { "binding": "CONFIG_KV", "id": "<CONFIG_KV_ID>", "preview_id": "<CONFIG_KV_PREVIEW_ID>" }
      ],
      "services": [
        { "binding": "TRADE_SERVICE", "service": "trade-worker" },
        { "binding": "TELEGRAM_SERVICE", "service": "telegram-worker" }
      ],
      "observability": {
        "enabled": true,
        "head_sampling_rate": 1
      },
      "queues": {
        "producers": [
          { "queue": "trade-execution", "binding": "TRADE_QUEUE" }
        ]
      },
      "durable_objects": {
        "bindings": [
          { "name": "IDEMPOTENCY_STORE", "class_name": "IdempotencyStore" }
        ],
        "migrations": [
          { "tag": "v1", "new_sqlite_classes": ["IdempotencyStore"] }
        ]
      }
    }
    ```
6.  Update the corresponding `worker-configuration.d.ts` file.
7.  For local development, create a `.dev.vars` file and define the secrets/variables:
    ```.dev.vars
    # Mock secret bindings for local dev:
    WEBHOOK_API_KEY_BINDING="your_external_api_key"
    INTERNAL_KEY="your_shared_internal_secret"
    ```

## Development

Run locally:

```bash
bun run dev
```

Deploy:

```bash
bun run deploy
```

## API Interface

### Incoming Request (External -> Webhook Receiver)

- **Method:** `POST`
- **Endpoint:** `/`

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
