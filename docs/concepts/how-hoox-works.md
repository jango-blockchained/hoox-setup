---
title: "How Hoox Works"
description: "High-level overview of signals, trades, and notifications"
---

# How Hoox Works

At a high level, Hoox is a pipeline that takes a trading signal and turns it into an executed order.

## The Flow

```
Signal arrives → Gateway validates → Routes to exchange → Executes trade → Records data → Sends notification
```

### 1. Signal Arrives

A signal is an instruction to trade — for example, "Buy 0.01 BTC on MEXC." Signals come from:

- **TradingView webhook** — An alert triggers a POST to your Hoox gateway URL
- **Telegram message** — You send a command to your Telegram bot
- **Email** — An email with specific subject/body patterns is parsed automatically

### 2. Gateway Validates

The Hoox gateway (the public-facing entry point) checks:

- Is the API key valid?
- Is the IP address allowed?
- Is trading paused (kill switch)?
- Is rate limiting exceeded?
- Has this exact signal been seen before? (Prevents duplicates)

### 3. Routes to Exchange

The gateway forwards the validated signal to the trade worker, which:

1. Looks up the exchange configuration (Binance, Bybit, or MEXC)
2. Checks if the symbol should be routed to a different exchange (dynamic routing)
3. Sends the order to the exchange API

### 4. Executes Trade

The exchange executes the order. The result (filled, partial, rejected) comes back to Hoox.

### 5. Records Data

Every trade is recorded in D1 (the edge database) — what was bought/sold, at what price, when, and on which exchange.

### 6. Sends Notification

A Telegram message is sent with the trade details. If configured, daily PDF reports summarize portfolio performance.

## Next Steps

- [Signals & Trades](signals-and-trades.md) — Detailed walkthrough of a signal becoming an order
- [Edge Architecture](edge-architecture.md) — How Cloudflare's global network makes this fast
