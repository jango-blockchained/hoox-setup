---
title: "Signals & Trades"
description: "How a TradingView alert becomes an executed order"
---

# Signals & Trades

## End-to-End Flow

Here's exactly what happens when a TradingView alert fires:

### 1. Alert Created in TradingView

You create a TradingView alert with a webhook URL pointing to your Hoox gateway:

```
POST https://hoox.your-prefix.workers.dev
```

The webhook payload includes the signal details:

```json
{
  "apiKey": "your-api-key",
  "exchange": "mexc",
  "action": "LONG",
  "symbol": "BTC_USDT",
  "quantity": 0.01
}
```

### 2. Gateway Receives and Validates

The hoox gateway:

1. Validates the API key against the stored secret
2. Checks the kill switch (is trading allowed?)
3. Verifies rate limits (not more than 10 trades per minute)
4. Checks idempotency (is this a duplicate?)
5. Logs the signal for analytics

### 3. Routes to Trade Worker

The gateway forwards the validated signal to the trade worker via a Cloudflare Queue (async, with retry).

### 4. Trade Worker Executes

The trade worker:

1. Looks up the exchange API credentials
2. Formats the order for the exchange's API
3. Sends the order
4. Stores the result in D1

### 5. Notification Sent

A Telegram message is sent with the order details: symbol, side, quantity, price, and status.

> **Deep dive:** [Worker Communication](../devops/architecture/communication.md) | [API Endpoints](../reference/api-endpoints.md)
