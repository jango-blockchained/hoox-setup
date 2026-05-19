---
title: "Telegram Bot"
description: "Set up Telegram notifications and commands"
---

# Telegram Bot

Set up a Telegram bot to receive trade notifications and send commands.

## Step 1: Create a Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the prompts
3. You'll receive a bot token &mdash; save it

## Step 2: Configure Hoox

Set the bot token:

```bash
hoox secrets update-cf TG_BOT_TOKEN_BINDING telegram-worker
```

## Step 3: Deploy the Webhook

```bash
hoox deploy telegram-webhook
```

## Step 4: Test

Send `/start` to your bot in Telegram. You should receive a confirmation message. Trade notifications will now arrive automatically.

## Next Steps

- [Email Signals](email-signals.md) &mdash; Add another signal source
- [Monitor Trading](../guides/monitor-trading.md) &mdash; Watch all signal sources
