---
title: "email-worker Isolate Profile"
description: "Engineering specification for the Hoox email parsing worker, covering Mailgun webhook ingestion, direct JSON signal parsing, KV-configured regex patterns, and service bindings."
---

# email-worker Isolate Profile

The **`email-worker`** ingests trading signals from email sources, parses them, and forwards them to `trade-worker` for execution. It receives emails via Mailgun webhook (`POST /webhook`) or direct JSON POST (`POST /email-signal`). No IMAP/SMTP polling — Cloudflare Workers edge runtime does not support the Node.js `net`/`tls` modules required for IMAP. SPF/DKIM verification is not implemented.

The worker also tracks signal ingestion metrics by forwarding event data to `analytics-worker` via service binding.

---

## 1. Endpoints

| Endpoint        | Method | Auth                            | Purpose                                      |
| --------------- | ------ | ------------------------------- | -------------------------------------------- |
| `/webhook`      | POST   | Mailgun signature (HMAC-SHA256) | Inbound Mailgun webhook for forwarded emails |
| `/email-signal` | POST   | `X-Internal-Auth-Key` header    | Direct JSON signal ingestion                 |
| `/health`       | GET    | None                            | Health check                                 |

> **Note:** The Mailgun webhook endpoint is `/webhook`, not `/webhook/mailgun`. The direct JSON endpoint is `/email-signal`, not `/process`.

---

## 2. Mailgun Signature Verification

When a POST arrives at `/webhook`, the worker validates the Mailgun signature before processing the email body:

1. Reads `Mailgun-Signature`, `Mailgun-Timestamp`, `Mailgun-Token` from request headers
2. Computes HMAC-SHA256 hex digest of `timestamp + token` using `MAILGUN_API_KEY` as the signing key
3. Compares computed digest against the `Mailgun-Signature` header value
4. Returns `401 Unauthorized` if headers are missing or signature does not match

```typescript
const dataToSign = timestamp + token;
const encoder = new TextEncoder();
const key = await crypto.subtle.importKey(
  "raw",
  encoder.encode(apiKey),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"]
);
const signatureBytes = await crypto.subtle.sign(
  "HMAC",
  key,
  encoder.encode(dataToSign)
);
const expectedSignature = Array.from(new Uint8Array(signatureBytes))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

if (signature !== expectedSignature) {
  return Errors.unauthorized("Invalid signature");
}
```

On success, the worker extracts the email body from the `body-plain` or `stripped-text` field of the Mailgun form-data payload and passes it to the signal parser.

---

## 3. Signal Extraction

Two-phase parsing: JSON first, plaintext fallback.

### Phase 1: JSON Parsing

`parseEmailSignal()` calls `JSON.parse()` on the body text. If the result contains `exchange`, `action`, and `symbol` fields, it returns a structured signal immediately:

```typescript
{
  exchange: "binance",     // normalized lowercase
  action: "buy",           // buy/long → buy | sell/short → sell
  symbol: "BTCUSDT",       // uppercased
  quantity: 100,           // multiplied by quantityMultiplier from KV
  price?: 45000,           // optional
  leverage?: 3             // optional
}
```

### Phase 2: Plaintext Fallback

If JSON parsing fails or required fields are missing, `extractFromPlaintext()` uses keyword matching:

- `extractField()` scans for `keyword:` prefixes (e.g. `exchange:`, `symbol:`, `action:`)
- Coin symbols and action keywords matched via regex from KV config (`coinPattern`, `actionPattern`)
- `normalizeExchange()` resolves exchanges: `binance`, `mexc`, `bybit`
- `normalizeAction()` maps: `buy`/`long` → `buy`, `sell`/`short` → `sell`

Example plaintext email body:

```
exchange: binance
symbol: BTCUSDT
action: buy
quantity: 1.5
```

### Forwarding

Once parsed, the signal is sent to `trade-worker` via:

```typescript
const response = await serviceFetch(env.TRADE_SERVICE, "/webhook", signal, {
  headers: {
    "X-Internal-Auth-Key": internalKey,
    "X-Source": "email-worker",
  },
});
```

Analytics events are sent non-blocking via `ctx.waitUntil()`:

```typescript
ctx.waitUntil(
  trackAnalytics(env, "/track/signal", {
    data: {
      source: "email-worker",
      type: signal.action,
      symbol: signal.symbol,
      confidence: 0.5,
    },
  })
);
```

---

## 4. Bindings

### Service Bindings

| Binding             | Target Worker    | Purpose                                      |
| ------------------- | ---------------- | -------------------------------------------- |
| `TRADE_SERVICE`     | trade-worker     | Forward parsed trading signals for execution |
| `ANALYTICS_SERVICE` | analytics-worker | Track signal ingestion metrics               |

### KV Namespaces

| Binding     | ID                                 | Purpose                      |
| ----------- | ---------------------------------- | ---------------------------- |
| `CONFIG_KV` | `c5917667a21745e390ff969f32b1847d` | Signal pattern configuration |

---

## 5. Secrets

All secrets are set via `wrangler secret` and appear in `wrangler.jsonc` vars with `__SECRET__` placeholders:

| Secret                 | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `INTERNAL_KEY_BINDING` | Shared internal auth key for service-to-service calls |
| `MAILGUN_API_KEY`      | Mailgun webhook signature verification (HMAC-SHA256)  |
| `EMAIL_HOST_BINDING`   | Reserved for future email host configuration          |
| `EMAIL_USER_BINDING`   | Reserved for future email user configuration          |
| `EMAIL_PASS_BINDING`   | Reserved for future email password configuration      |

> **Warning:** `EMAIL_HOST_BINDING`, `EMAIL_USER_BINDING`, and `EMAIL_PASS_BINDING` are reserved placeholders. They are not actively used — IMAP polling is not available in Workers edge runtime.

---

## 6. Environment Variables (Vars)

| Variable            | Value          | Purpose                                                       |
| ------------------- | -------------- | ------------------------------------------------------------- |
| `TRADE_WORKER_NAME` | `trade-worker` | Service name of trade-worker (reference only)                 |
| `USE_IMAP`          | `"false"`      | IMAP polling disabled — not supported in Workers edge runtime |

> **Note:** `USE_IMAP` is `"false"` in production. The scheduled handler (`*/5 * * * *` cron trigger) logs that IMAP scanning is disabled; use Mailgun webhook or direct JSON POST instead.

---

## 7. KV Configuration Keys

The worker loads signal parsing patterns from `CONFIG_KV` via `loadSignalPatterns()`:

| KV Key                      | Default                  | Purpose                                        |
| --------------------------- | ------------------------ | ---------------------------------------------- |
| `email:coin_pattern`        | `BTC\|ETH\|SOL`          | Regex for matching asset symbols in email body |
| `email:action_pattern`      | `buy\|sell\|long\|short` | Regex for matching trade action direction      |
| `email:quantity_multiplier` | `1`                      | Coefficient applied to parsed quantity values  |

```typescript
// Keys accessed via the KVKeys shared namespace
import { KVKeys } from "@jango-blockchained/hoox-shared/kvKeys";

const [coinPattern, actionPattern, quantityMultiplier] = await Promise.all([
  env.CONFIG_KV?.get(KVKeys.KV_EMAIL_COIN_PATTERN).then(
    (v) => v || "BTC|ETH|SOL"
  ),
  env.CONFIG_KV?.get(KVKeys.KV_EMAIL_ACTION_PATTERN).then(
    (v) => v || "buy|sell|long|short"
  ),
  env.CONFIG_KV?.get(KVKeys.KV_EMAIL_QUANTITY_MULTIPLIER).then((v) =>
    v ? parseFloat(v) : 1
  ),
]);
```

Additional KV keys defined for the email-worker but not actively consumed:

| KV Key               | Purpose                        |
| -------------------- | ------------------------------ |
| `email:scan_subject` | Subject line filter (reserved) |
| `email:use_imap`     | IMAP enable flag (reserved)    |

---

## 8. Observability

Full observability enabled with 100% head sampling:

```jsonc
{
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "persist": true,
      "invocation_logs": true,
    },
  },
}
```

- **Head sampling rate**: 1 (all requests sampled)
- **Log persistence**: Enabled — logs stored for debugging and audit
- **Invocation logs**: Enabled — full invocation records available
- **Smart Placement**: Enabled for 30-60% latency reduction

---

## 9. Configuration (wrangler.jsonc)

```jsonc
{
  "name": "email-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-17",
  "compatibility_flags": ["nodejs_compat"],
  "account_id": "debc6545e63bea36be059cbc82d80ec8",
  "placement": {
    "mode": "smart",
  },
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "persist": true,
      "invocation_logs": true,
    },
  },
  "vars": {
    "TRADE_WORKER_NAME": "trade-worker",
    "USE_IMAP": "false",
    "INTERNAL_KEY_BINDING": "__SECRET__",
    "EMAIL_HOST_BINDING": "__SECRET__",
    "EMAIL_USER_BINDING": "__SECRET__",
    "EMAIL_PASS_BINDING": "__SECRET__",
    "MAILGUN_API_KEY": "__SECRET__",
    "EMAIL_SCAN_SUBJECT": "__SECRET__",
  },
  "kv_namespaces": [
    {
      "binding": "CONFIG_KV",
      "id": "c5917667a21745e390ff969f32b1847d",
    },
  ],
  "services": [
    {
      "binding": "TRADE_SERVICE",
      "service": "trade-worker",
    },
    {
      "binding": "ANALYTICS_SERVICE",
      "service": "analytics-worker",
    },
  ],
  "triggers": {
    "crons": ["*/5 * * * *"],
  },
}
```

---

## 10. Development

```bash
# Run email-worker unit tests
bun test workers/email-worker/

# Start local dev server
hoox dev worker email-worker

# Deploy
hoox workers deploy
```

Config tracking: `wrangler.jsonc` is tracked in git.

---

## 11. Architecture Context

The email-worker is one of 10 workers in the Hoox service binding mesh:

```
Email source → email-worker → trade-worker → d1-worker (persist)
                            → analytics-worker (track)
```

- **Mailgun flow**: Inbound email → Mailgun webhook POST → email-worker `/webhook` → trade-worker
- **Direct flow**: Internal tooling → `POST /email-signal` (authenticated) → email-worker → trade-worker
- **Gateway flow**: `hoox` gateway → direct POST to email-worker → trade-worker
- **Analytics**: Every parsed signal sends `{ source, type, symbol, confidence }` to analytics-worker

Cron trigger (`*/5 * * * *`) exists but the scheduled handler only logs that IMAP scanning is disabled. All active signal ingestion is via webhook or direct POST.

---

### Next Steps

- **[trade-worker Profile](trade-worker.md)** — How parsed signals become execution orders
- **[analytics-worker Profile](analytics-worker.md)** — Signal tracking and observability
- **[Architecture Overview](../architecture/overview.md)** — Full system architecture and data flow
