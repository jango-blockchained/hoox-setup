---
title: "📚 Hoox Documentation"
description: "User guide for the Hoox algorithmic trading CLI"
---

# 📚 Hoox Documentation

> User guide for the Hoox algorithmic trading CLI platform.

## 👋 New to Hoox? Start Here

- [Installation](getting-started/installation.md) — Install the CLI and bootstrap your project
- [Quick Start](getting-started/quick-start.md) — Send your first trade in 5 minutes
- [How Hoox Works](concepts/how-hoox-works.md) — High-level overview of signals, trades, and notifications

## 📘 Guides

- [Deploy Workers](guides/deploy-workers.md) — Deploy and update your trading infrastructure
- [Manage Infrastructure](guides/manage-infra.md) — D1, KV, R2, Queues via hoox infra
- [Monitor Trading](guides/monitor-trading.md) — Health checks, kill switch, logs, and metrics
- [Database Operations](guides/database-ops.md) — Schema, migrations, queries, and backups
- [Repair & Recovery](guides/repair.md) — Diagnose and fix system issues
- [Secrets & Security](guides/secrets-security.md) — Manage API keys and secrets
- [Local Development](guides/local-development.md) — Develop with hot-reload, TUI, or Docker
- [Terminal UI (TUI)](guides/tui.md) — Full-screen terminal operations center

## 🧠 Concepts

- [Cloudflare Services Explained](concepts/cloudflare-services.md) — D1, KV, R2, Queues, Vectorize in plain English
- [Edge Architecture](concepts/edge-architecture.md) — What Cloudflare Workers means for latency
- [Idempotency](concepts/idempotency.md) — How Durable Objects prevent duplicate trades
- [Signals & Trades](concepts/signals-and-trades.md) — How a TradingView alert becomes an order
- [AI Risk Manager](concepts/ai-risk-manager.md) — Automated portfolio monitoring and protection

## 📖 Reference

- [CLI Commands](reference/cli-commands.md) — Full command tree and flags
- [API Endpoints](reference/api-endpoints.md) — Webhook HTTP API reference
- [Configuration](getting-started/configuration.md) — Environment variables, secrets, and settings

## 🎯 Tutorials

- [TradingView Webhook](tutorials/tradingview-webhook.md) — Connect TradingView alerts to Hoox
- [Telegram Bot](tutorials/telegram-bot.md) — Set up notifications and commands
- [Email Signals](tutorials/email-signals.md) — Configure email parsing for trade signals

## 🔗 Quick Links

- [GitHub Repository](https://github.com/jango-blockchained/hoox-setup)
- [Report Issues](https://github.com/jango-blockchained/hoox-setup/issues)
- [DevOps Manual](devops/home.md) — For operators and infrastructure engineers
