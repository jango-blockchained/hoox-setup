---
title: "TradingView Webhook"
description: "Connect TradingView alerts to Hoox"
---

# TradingView Webhook

Connect a TradingView alert to automatically execute trades through Hoox.

## Step 1: Get Your Gateway URL

After deployment, your gateway is at:

```
https://hoox.your-prefix.workers.dev
```

Replace `your-prefix` with the subdomain prefix you chose during `hoox init`.

## Step 2: Create a TradingView Alert

1. Open a chart in TradingView
2. Click the alarm clock icon (Alerts)
3. Click "Create Alert"
4. Set your condition (e.g., price crosses a moving average)
5. In the "Webhook URL" field, enter your gateway URL
6. In the "Message" field, enter the JSON payload:

```json
{
  "apiKey": "your-api-key",
  "exchange": "mexc",
  "action": "LONG",
  "symbol": "BTC_USDT",
  "quantity": 0.01
}
```

7. Click "Create"

## Step 3: Test the Alert

Trigger the alert condition manually or wait for it to fire. Check the result:

```bash
hoox monitor trades
```

## Troubleshooting

| Problem                          | Fix                                                       |
| -------------------------------- | --------------------------------------------------------- |
| Alert fires but no trade appears | Check gateway logs: `hoox logs tail hoox`                 |
| "401 Unauthorized"               | Verify your API key: `hoox secrets check`                 |
| Wrong exchange                   | Check exchange API keys are set: `hoox secrets update-cf` |

## Next Steps

- [Telegram Bot](telegram-bot.md) &mdash; Get notified when trades execute
- [API Reference](../reference/api-endpoints.md) &mdash; Full endpoint documentation
