---
title: "Email Signals"
description: "Configure email parsing for trade signals"
---

# Email Signals

Configure Hoox to parse trading signals from email messages.

## Step 1: Configure Email Settings

Set your email credentials:

```bash
hoox secrets update-cf EMAIL_HOST_BINDING email-worker
hoox secrets update-cf EMAIL_USER_BINDING email-worker
hoox secrets update-cf EMAIL_PASS_BINDING email-worker
```

## Step 2: Configure Parsing Rules

Set the email scanning patterns:

```bash
hoox config kv set email:scan_subject "TRADE SIGNAL"
hoox config kv set email:coin_pattern "(BTC|ETH|SOL)"
hoox config kv set email:action_pattern "(BUY|SELL)"
```

## Step 3: Test

Send an email to your configured address with the subject "TRADE SIGNAL" and the signal details in the body. Check if it was processed:

```bash
hoox monitor logs email-worker
```

## Next Steps

- [Monitor Trading](../guides/monitor-trading.md) &mdash; Watch all signal sources
- [TradingView Webhook](tradingview-webhook.md) &mdash; Add TradingView alerts
