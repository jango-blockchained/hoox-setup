---
title: "AI Risk Manager"
description: "Automated portfolio monitoring and protection"
---

# AI Risk Manager

## What It Does

The agent-worker (AI risk manager) runs every 5 minutes on a cron schedule and performs several automated checks:

### 1. Position Monitoring

Checks all open positions against configured thresholds:

- **Trailing stops** — Moves stop-losses up as trades become profitable
- **Take-profit levels** — Scales out of profitable positions
- **Max drawdown** — If total losses exceed the configured percentage, the kill switch is triggered

### 2. Kill Switch

A global emergency brake that halts ALL trading immediately:

```bash
# Check status
hoox monitor kill-switch show

# Halt trading
hoox monitor kill-switch on

# Resume
hoox monitor kill-switch off
```

The kill switch is stored in KV — no redeployment needed. Changes take effect on the next request cycle.

### 3. Health Summaries

The AI risk manager can generate periodic summaries of:

- Portfolio value and P&L
- Open positions and exposure
- Recent trade history
- System health status

These summaries can be delivered via Telegram.

### 4. Multi-Provider AI

Behind the scenes, the agent-worker has access to 5 AI providers (Workers AI, OpenAI, Anthropic, Google AI, Azure OpenAI) with automatic fallback. If one provider is down, the next one is tried automatically.

## What This Means for You

- **24/7 monitoring** — Even when you're not watching the charts
- **Automatic protection** — Stop-losses and kill switch run without manual intervention
- **Configurable** — All thresholds are adjustable via KV without code changes

> **Deep dive:** [agent-worker docs](../devops/workers/agent-worker.md)
