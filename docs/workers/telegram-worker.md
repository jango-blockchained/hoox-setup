# Telegram Worker

**Last Updated:** April 2026

A Cloudflare® Worker service that handles interactions with the Telegram Bot API. It can send messages, process incoming commands (via webhook or polling), and potentially leverage other Cloudflare® services like R2, AI, and Vectorize.

## Features

- Sends formatted messages (HTML/Markdown) to specified Telegram chats.
- Can be configured to receive and process incoming commands (e.g., `/ask`, `/search`).
- Secure authentication via shared internal key when receiving requests from other workers (e.g., `hoox`).
- Secure authentication for incoming Telegram webhooks using a secret URL path.
- Potential integration with:
  - **R2:** Storing/retrieving user uploads or generated files (`UPLOADS_BUCKET`).
  - **Workers AI:** Processing commands, generating responses, RAG (`AI` binding).
  - **Vectorize:** Storing embeddings for RAG/semantic search (`VECTORIZE_INDEX`).
  - **KV:** Storing user preferences or configuration (`CONFIG_KV`).

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare® Workers account
- Telegram Bot Token (obtained from @BotFather).

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare® account ID in `wrangler.jsonc`.
3.  Configure Secrets (via Cloudflare® dashboard Secrets Store or `wrangler secret put`):
    - `INTERNAL_KEY_BINDING`: The **shared** secret key used for authentication with other internal workers.
    - `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token.
    - `TELEGRAM_CHAT_ID_DEFAULT`: The default Telegram Chat ID for outbound messages if none is specified.
    - `TELEGRAM_WEBHOOK_SECRET`: A secure, random string used to authenticate incoming webhook requests from Telegram.
4.  Update `wrangler.jsonc` with appropriate bindings and variables. Example:
    ```jsonc
    {
      "name": "telegram-worker",
      "main": "src/index.ts",
      "compatibility_date": "2025-03-07",
      "compatibility_flags": ["nodejs_compat"],
      "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
      "secrets": [
        "INTERNAL_KEY_BINDING",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID_DEFAULT",
        "TELEGRAM_WEBHOOK_SECRET"
      ],
      "kv_namespaces": [
        { "binding": "CONFIG_KV", "id": "...", "preview_id": "..." }
      ],
      "r2_buckets": [
        { "binding": "UPLOADS_BUCKET", "bucket_name": "user-uploads" }
      ],
      "vectorize": [
        { "binding": "VECTORIZE_INDEX", "index_name": "my-rag-index" }
      ],
      "ai": {
        "binding": "AI"
      },
      "observability": {
        "enabled": true,
        "head_sampling_rate": 1
      }
    }
    ```
5.  Update the corresponding `worker-configuration.d.ts` file.
6.  Set the Telegram webhook (replace `<WORKER_URL>` and `<SECRET_PATH>`):
    ```bash
    curl "https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=<WORKER_URL>/telegram/<TELEGRAM_WEBHOOK_SECRET>"
    ```
7.  For local development, create a `.dev.vars` file and define the secrets/variables:
    ```.dev.vars
    # Mock secrets for local dev:
    INTERNAL_KEY_BINDING="your_shared_internal_secret"
    TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
    TELEGRAM_CHAT_ID_DEFAULT="your_default_telegram_chat_id"
    TELEGRAM_WEBHOOK_SECRET="your_local_webhook_secret"
    ```

## Development

Run locally:

```bash
bun run dev
```

_Note: Receiving Telegram webhooks locally requires a tunneling service like `cloudflared tunnel`._

Deploy:

```bash
bun run deploy
```

## API Interface

### 1. Internal Processing Request (`/process`)

This worker accepts requests from authenticated internal services (like `hoox`) on the `/process` endpoint, typically for sending notifications.

- **Method:** `POST`
- **Endpoint:** `/process`
- **Content-Type:** `application/json`
- **Expected Request Body:**

  ```json
  {
    "requestId": "<uuid_from_caller>",
    "internalAuthKey": "YOUR_INTERNAL_SHARED_SECRET",
    "payload": {
      "message": "<b>Trade Alert!</b>\nSymbol: <code>BTCUSDT</code>\nAction: LONG",
      "chatId": "123456789",
      "parseMode": "HTML"
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

### 2. Telegram Webhook (`/telegram/<TELEGRAM_WEBHOOK_SECRET>`)

Handles incoming updates (messages, commands) from Telegram.

- **Method:** `POST`
- **Endpoint:** `/telegram/<TELEGRAM_WEBHOOK_SECRET>`

## Message Formatting

The worker typically defaults to sending messages with `parse_mode` set to `HTML`. You can include HTML tags like `<b>`, `<i>`, `<code>`, `<pre>`, `<a>` in the `message` field. `MarkdownV2` can also be specified.

## Security

- Internal requests to `/process` _must_ include a valid `internalAuthKey`.
- Incoming Telegram webhooks are authenticated using the secret path segment (`TELEGRAM_WEBHOOK_SECRET`).
- The Telegram Bot Token and other secrets are stored securely using Cloudflare® Workers Secrets.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
