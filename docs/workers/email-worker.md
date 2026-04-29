# Email Worker

**Last Updated:** April 2026

The `email-worker` is responsible for scanning emails and triggering trading signals. It can receive data via Mailgun webhooks or direct JSON payloads, and forwards parsed signals to the `trade-worker`.

## Features

- **Mailgun Webhook Support**: Validates and processes incoming emails routed via Mailgun.
- **Direct JSON Payload**: Accepts direct JSON requests for testing or integration.
- **Signal Parsing**: Extracts trading signals (Exchange, Action, Symbol, Quantity) from both JSON and plaintext email bodies.
- **Service Binding**: Forwards parsed signals to the `trade-worker` via `TRADE_SERVICE`.

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare® Workers account

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare® account ID in `wrangler.jsonc`.
3.  Configure Secrets:
    - `INTERNAL_KEY_BINDING`: Shared secret key for internal authentication.
    - `MAILGUN_API_KEY`: Required for validating Mailgun webhooks.

## Configuration (via KV)

The worker can be configured dynamically using keys in `CONFIG_KV`:

| Key | Default | Description |
| --- | --- | --- |
| `email:coin_pattern` | `BTC\|ETH\|SOL` | Regex pattern for matching symbols. |
| `email:action_pattern` | `BUY\|SELL\|LONG\|SHORT` | Regex pattern for matching actions. |
| `email:quantity_multiplier` | `1` | Multiplier applied to parsed quantities. |

## API Interface

### 1. Mailgun Webhook

Handles incoming updates from Mailgun.

- **Method:** `POST`
- **Headers**: Must include `Mailgun-Signature`, `Mailgun-Timestamp`, and `Mailgun-Token`.

### 2. Direct JSON

- **Method:** `POST`
- **Content-Type**: `application/json`
- **Expected Body**:
  ```json
  {
    "subject": "Trading Signal",
    "text": "Exchange: Binance\nAction: BUY\nSymbol: BTCUSDT\nQuantity: 1"
  }
  ```

## Security

- Validates HMAC signatures for all Mailgun webhooks.
- Forwards requests internally using the `INTERNAL_KEY_BINDING`.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
