---
title: "email-worker Isolate Profile"
description: "Comprehensive engineering specification for the Hoox Email Parsing Worker, covering SMTP/IMAP routing, Mailgun webhooks, and regex parser patterns."
---

# 📧 email-worker Isolate Profile

The **`email-worker`** is an ancillary signal ingestion plugin. Deployed as a private compute isolate, this service is responsible for intercepting trading signals distributed via email lists, newsletters, or alert emails (e.g. from TradingView or custom notification pipelines). It validates domain security (SPF/DKIM), parses message subjects and bodies using dynamic **Regular Expressions**, and routes the extracted signals privately to `trade-worker` via V8 Service Bindings.

---

## ⚡ 1. Declared Wrangler Configurations & Bindings

The `email-worker` does not expose any public endpoints, connecting internally to active executors and metrics collectors:

```jsonc
{
  "name": "email-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-19",
  "compatibility_flags": ["nodejs_compat"],
  "account_id": "debc6545e63bea36be059cbc82d80ec8",
  "vars": {
    "USE_IMAP": "true",
  },
  "kv_namespaces": [
    {
      "binding": "CONFIG_KV",
      "id": "c5917667a21745e390ff969f32b1847d",
    },
  ],
  "services": [
    { "binding": "TRADE_SERVICE", "service": "trade-worker" },
    { "binding": "ANALYTICS_SERVICE", "service": "analytics-worker" },
  ],
  "secrets": [
    "INTERNAL_KEY_BINDING",
    "EMAIL_HOST_BINDING",
    "EMAIL_USER_BINDING",
    "EMAIL_PASS_BINDING",
    "MAILGUN_API_KEY",
  ],
}
```

---

## 🔑 2. Environmental Variables & Encrypted Secrets

- **`EMAIL_HOST_BINDING`**: POP3/IMAP mailbox server address (e.g., `imap.gmail.com`).
- **`EMAIL_USER_BINDING`**: Dedicated signals email mailbox username.
- **`EMAIL_PASS_BINDING`**: Secure app-specific password.
- **`MAILGUN_API_KEY`**: Key used to validate incoming SMTP webhooks if using Mailgun routing.
- **`INTERNAL_KEY_BINDING`**: Shared key used to validate calls from internal compute nodes.

---

## 🗃️ 3. Regex Parsing Mechanics in V8

When a new email is scanned or received via webhook, the worker evaluates the content against regular expression arrays stored in `CONFIG_KV`:

| Configuration Key           |   Type   | Default Pattern            | Parser Purpose                                               |
| :-------------------------- | :------: | :------------------------- | :----------------------------------------------------------- |
| `email:scan_subject`        | `string` | `^TRADE SIGNAL:.*`         | Resolves whether the email should be parsed or ignored.      |
| `email:coin_pattern`        | `string` | `(BTC\|ETH\|SOL\|LINK)`    | Matches uppercase asset tokens in the email body.            |
| `email:action_pattern`      | `string` | `(BUY\|SELL\|LONG\|SHORT)` | Resolves buy/sell execution parameters.                      |
| `email:quantity_multiplier` | `number` | `1.0`                      | Coefficient applied to parsed quantities to scale positions. |

```typescript
// Under the hood regex parsing logic
const subjectRegex = new RegExp(env.CONFIG_KV.get("email:scan_subject"));
const coinRegex = new RegExp(env.CONFIG_KV.get("email:coin_pattern"));
const actionRegex = new RegExp(env.CONFIG_KV.get("email:action_pattern"));

if (subjectRegex.test(email.subject)) {
  const asset = email.body.match(coinRegex)?.[0]; // Extracts "BTC"
  const action = email.body.match(actionRegex)?.[0]; // Extracts "LONG"
  // Routes to trade-worker...
}
```

---

## 🔌 4. API Interface Specification

While the worker primarily runs background Cron scan loops, it exposes two ingestion endpoints for webhook integrations (e.g. Mailgun/SendGrid):

### A. Mailgun Webhook Router

- **Endpoint**: `/webhook/mailgun`
- **Method**: `POST`
- **Headers**: `Mailgun-Signature`, `Mailgun-Timestamp`, `Mailgun-Token`
- **Security**: The worker computes the HMAC-SHA256 signature of the timestamp and token using your `MAILGUN_API_KEY` secret. If the calculated signature doesn't match the header, the request is instantly rejected (401 Unauthorized).

---

### B. Direct JSON Payload Ingestion

Used primarily by administrative automation tools or local testing scripts.

- **Endpoint**: `/process`
- **Method**: `POST`
- **JSON Payload**:
  ```json
  {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "payload": {
      "sender": "alerts@tradingview.com",
      "subject": "TRADE SIGNAL: Breakout SOL",
      "body": "Action: LONG, Asset: SOLUSDT, Size: 1.5"
    }
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "result": { "symbol": "SOLUSDT", "action": "LONG", "quantity": 1.5 },
    "error": null
  }
  ```

---

## 🛡️ 5. Domain Ingress Protections: SPF & DKIM

To protect your wallet against email spoofing attacks:

1. **DKIM Check**: Validates the cryptographic DKIM signature in the email header to prove the message body was not altered in transit.
2. **SPF Check**: Matches the sending server's IP address against the DNS TXT SPF record of the authorized domain, dropping forged emails before parsing.

### 🔗 Next Steps

- **[trade-worker Profile](trade-worker.md)** — Review how execution orders route transactions to EVM wallet nodes.
- **[System Storage Architecture](../architecture/storage.md)** — Review SQLite properties and R2 bucketing pipelines.
