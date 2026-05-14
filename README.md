# 🚀 Hoox — Trading Command Center for Your Terminal

<div align="center">

[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/Runtime-Bun-black?style=for-the-badge&logo=bun)](https://bun.sh)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare®%20Edge%20Workers-orange?style=for-the-badge&logo=cloudflare)](https://workers.cloudflare.com/)
[![Coverage](https://img.shields.io/badge/Coverage-80%25-brightgreen.svg?style=for-the-badge)](docs/development/testing.md)
[![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg?style=for-the-badge)](https://creativecommons.org/licenses/by/4.0/)
[![Docs](https://img.shields.io/badge/Docs-docs/home.md-blue?style=for-the-badge)](docs/home.md)

</div>

> **Free, open-source CLI for algorithmic trading on Cloudflare's edge network.**
>
> Install once, deploy globally — no server management, no infrastructure headaches.

---

## Install

```bash
bun add -g @jango-blockchained/hoox-cli
```

## Quick Start — First Trade in 5 Minutes

```bash
hoox init                  # Interactive setup wizard
hoox clone my-trading-app  # Bootstrap the project (git submodules)
cd my-trading-app
hoox deploy all            # Deploy all workers to Cloudflare in dependency order
```

That's it. Your trading infrastructure is live on Cloudflare's edge network — geographically near exchange servers for minimal latency.

## What You Can Do

- **Trade across exchanges** — Send signals to Binance, Bybit, and MEXC from one CLI. Route symbols to different exchanges without redeploying.
- **Automated risk management** — AI risk manager monitors open positions, moves trailing stops, and can halt all trading instantly via a kill switch.
- **Notifications everywhere** — Telegram bot sends trade confirmations, alerts, and daily summaries. Email parsing lets you trigger trades from signals.
- **Enterprise-grade infrastructure** — Runs on Cloudflare's free tier ($0 to start). D1 database, KV config, R2 storage, async queues, and Durable Objects for idempotent execution.
- **Terminal UI** — `hoox dev start` launches all 9 workers locally with hot-reload. Interactive TUI for process management.

## Commands at a Glance

```
hoox
├── init          Interactive setup wizard
├── clone         Clone worker repos as git submodules
├── dev           Local development (native or Docker)
├── deploy        Deploy workers, dashboard, Telegram webhook, KV config
├── infra         Manage D1, KV, R2, Queues, Vectorize, Analytics
├── config        Manage wrangler.jsonc, env vars, KV keys, secrets
├── check         Validate prerequisites, setup, and worker health
├── db            D1 database operations (apply, migrate, query, export, reset)
├── monitor       Health checks, recent trades, kill switch, logs, backup
├── repair        System check, per-component repair, guided rebuild
├── logs          Stream and filter worker logs
├── test          Run CI pipeline (lint → typecheck → test → build)
└── waf           Manage Cloudflare WAF rules
```

## Next Steps

| I want to... | Go here |
|-------------|---------|
| Install & configure Hoox | [Getting Started](docs/getting-started/installation.md) |
| Send my first trade | [Quick Start Guide](docs/getting-started/quick-start.md) |
| Understand how it works | [Concepts](docs/concepts/how-hoox-works.md) |
| Deploy to production | [Deploy Guide](docs/guides/deploy-workers.md) |
| Monitor my system | [Monitoring Guide](docs/guides/monitor-trading.md) |
| Fix something broken | [Repair Guide](docs/guides/repair.md) |
| Set up infrastructure (operators) | [DevOps Manual](docs/devops/home.md) |
| Contribute | [CONTRIBUTING.md](CONTRIBUTING.md) |

## ⚠️ Disclaimer

Hoox is provided "as-is" for educational and research purposes only. Algorithmic trading involves substantial risk — you may lose some or all of your invested capital. See [DISCLAIMER.md](DISCLAIMER.md) and [LICENSE](LICENSE) for full terms.

---

<div align="center">
Built with 🔥 on the <a href="https://workers.cloudflare.com/">Cloudflare® Edge</a>.
</div>
