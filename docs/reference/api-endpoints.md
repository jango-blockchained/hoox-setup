---
title: "API Endpoints"
description: "Webhook and health endpoint reference"
---

# API Endpoints

The Hoox gateway exposes the following HTTP endpoints for receiving trading signals.

## Main Webhook

```
POST /
```

Sends a trading signal to be executed. This is the primary endpoint used by TradingView alerts, custom scripts, and automation tools.

### Request

```json
{
  "apiKey": "your-api-key",
  "exchange": "mexc",
  "action": "LONG",
  "symbol": "BTC_USDT",
  "quantity": 0.01
}
```

### Response

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "orderId": "exchange-order-id"
  }
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string | Yes | Your gateway API key |
| `exchange` | string | Yes | Target exchange: `binance`, `bybit`, or `mexc` |
| `action` | string | Yes | `LONG`, `SHORT`, or `CLOSE` |
| `symbol` | string | Yes | Trading pair (e.g., `BTC_USDT`, `ETH_USDT`) |
| `quantity` | number | Yes | Amount to trade |
| `orderType` | string | No | `market` (default) or `limit` |
| `price` | number | No | Required if `orderType` is `limit` |

## Health Check

```
GET /health
```

Verifies the gateway is running and responsive.

### Response

```json
{
  "status": "ok"
}
```

> **Deep dive:** [Full API Reference](../devops/api/endpoints.md) | [Payloads](../devops/api/payloads.md) | [Responses](../devops/api/responses.md)
