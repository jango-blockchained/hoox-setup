# 🚀 Hoox - The Zero-Latency Edge Trading Ecosystem

<div align="center">

[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/Runtime-Bun-black?style=for-the-badge&logo=bun)](https://bun.sh)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare®%20Edge%20Workers-orange?style=for-the-badge&logo=cloudflare)](https://workers.cloudflare.com/)
[![Coverage](https://img.shields.io/badge/Coverage-80%25-brightgreen.svg?style=for-the-badge)](docs/development/testing.md)
[![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg?style=for-the-badge)](https://creativecommons.org/licenses/by/4.0/)
[![Main Repo](https://img.shields.io/badge/Main%20Repo-hoox--setup-blue?style=for-the-badge&logo=github)](https://github.com/jango-blockchained/hoox-setup)

**Comprehensive Docs:** **[Documentation Home](docs/home.md)** · **[Report a Bug](https://github.com/jango-blockchained/hoox-setup/issues)**

</div>

> **Low-latency edge trading.** Hoox is a free and open-source algorithmic trading and automation framework. Built on **Cloudflare® Workers**, Hoox utilizes a globally distributed, microservice edge architecture. Process signals, execute trades, and manage state with **low latency**, directly from the network edge closest to the exchange.

---

## 🔁 Required clone mode

This repository uses Git submodules for worker repositories. You must clone it recursively:

```bash
git clone --recursive https://github.com/jango-blockchained/hoox-setup.git hoox-trading
```

---

## 📖 Quick Navigation

| Document | Purpose |
|----------|---------|
| **[AGENTS.md](AGENTS.md)** | AI agent instructions — project structure, commands, testing, local dev setup, edge constraints, secret mgmt |
| **[DESIGN.md](DESIGN.md)** | Architecture decisions — detailed diagrams, data models, infra bindings, service binding maps, UI/UX rules |

---

## 🌟 Why Hoox?

Hoox provides a modern approach to algorithmic trading infrastructure deployment.

- 💸 **Cost-Effective & Open Source:** Hoox leverages Cloudflare®'s free tiers, allowing you to run your trading infrastructure with minimal or no server costs.
- ⚡ **Edge Execution:** Your code runs on Cloudflare®'s Edge, geographically close to exchange API servers (like Binance, Bybit, and MEXC). When a signal fires, Hoox executes with minimal network latency.
- 🛡️ **Built-in Security:** Hoox inherits Cloudflare®'s security features. With a Zero Trust architecture, strict IP Allow-listing, and encrypted internal Service Bindings, your API keys and trading strategies are well-protected.
- 🧠 **Automated Management:** Featuring an embedded risk manager (`agent-worker`), Hoox can monitor your portfolio, manage trailing stops, trigger kill-switches, and send system health summaries.

---

## ⚠️ Disclaimer

Hoox is provided "as-is" for educational and research purposes only. The authors, contributors, and copyright holders make no warranties regarding the software and disclaim all liability for any financial losses resulting from its use.

**No Financial Advice.** Nothing in this repository constitutes financial, investment, or trading advice. Users are solely responsible for their own trading decisions and must evaluate all risks independently.

**Risk of Loss.** Algorithmic trading on centralized and decentralized exchanges involves substantial risk. Past performance is not indicative of future results. You may lose some or all of your invested capital.

**Regulatory Compliance.** Users are responsible for ensuring compliance with applicable laws and regulations in their jurisdiction. Trading activities may be subject to licensing requirements, reporting obligations, or restrictions depending on your location.

**No Warranties.** The software is provided under CC BY 4.0 without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, or non-infringement. See the [LICENSE](LICENSE) and [DISCLAIMER](DISCLAIMER.md) for full details.

---

## 🚀 Quick Start (Deploy in 5 Minutes)

### Install from Source

```bash
git clone --recursive https://github.com/jango-blockchained/hoox-setup.git hoox-trading
cd hoox-trading
bun install
hoox init
```

### Deploy

```bash
# Deploy all workers + dashboard (correct dependency order)
hoox deploy all --auto

# Post-deploy: Telegram webhook, internal URLs, KV manifest
hoox deploy telegram-webhook
hoox deploy update-internal-urls
hoox deploy kv-config
```

> **Local Development:** Run `hoox dev start` to launch all workers (Native or Docker runtime). See [AGENTS.md](AGENTS.md#local-development) for detailed instructions on Docker Compose profiles, runtime selection, and TUI usage.

---

## ✨ Enterprise-Grade Features

### Core Platform

| Feature                          | Description                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔗 **Service Bindings**          | Microsecond inter-worker communication—no public internet routing, no TLS overhead, no DNS resolution. Workers call each other via internal V8 isolates.                                          |
| 📨 **Async Queues**              | Cloudflare® Queues with exponential backoff retry policy (30s → 15min). Guaranteed delivery survives exchange downtime, API rate limits, and network partitions.                                  |
| 🛡️ **Idempotent Execution**      | Durable Objects with SQLite-backed state prevent duplicate trades on network retries. Every webhook gets a unique trace ID for end-to-end signal tracking.                                        |
| 🤖 **Multi-Provider AI Gateway** | 5 AI providers (Workers AI, OpenAI, Anthropic, Google AI, Azure OpenAI) with automatic fallback chain, health checks, SSE streaming, vision analysis, reasoning models, and usage tracking.       |
| 🧠 **AI Risk Manager**           | `agent-worker` runs on a 5-minute cron: monitors open positions, moves trailing stops, scales out of profitable trades, flips the Global Kill Switch on max drawdown, and sends health summaries. |
| ⚡ **Smart Placement**            | Zero-config latency optimization — Workers automatically run on the edge node closest to exchange API servers. 30-60% latency reduction, $0 cost (free on all plans).                              |
| 🔄 **Real DO Idempotency**       | Durable Object with SQLite-backed persistence, TTL-based dedup, and automatic alarm cleanup. Prevents duplicate trades on network retries across cold starts.                                       |

### Data & Storage

| Feature                    | Description                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🗄️ **D1 Edge Database**    | Globally distributed SQLite at the edge. Persistent, atomic storage for trade history, positions, and balances. Preserved write limits via R2 log offloading. |
| 📦 **R2 Object Storage**   | Zero-egress, S3-compatible storage for trade reports, system logs, and user uploads. No bandwidth charges on retrieval.                                       |
| 🔐 **KV Configuration**    | Sub-millisecond global key-value store for dynamic routing, IP allowlists, session state, kill-switch toggles, and live settings—no redeployment required.    |
| 🔎 **Vectorize RAG Index** | Embedded vector database for retrieval-augmented generation. Powers context-aware AI responses and intelligent Telegram bot conversations.                    |
| 📊 **Analytics Engine**    | Time-series analytics dataset for tracking API call latency, error rates, and trade execution metrics across all workers. Free on all plans.                   |

### Trading Infrastructure

| Feature                      | Description                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📈 **Multi-Exchange Engine** | Execute across Binance, Bybit, and MEXC with dynamic routing via `CONFIG_KV`. Redirect symbols to different exchanges instantly without code deployment. |
| 🌐 **DeFi Execution**        | On-chain swap execution via `web3-wallet-worker` with secure mnemonic management and browser rendering for DApp interactions.                            |
| 📧 **Email Signal Parsing**  | Trigger trades from raw email parsing via `email-worker`. Ancillary input channel alongside TradingView webhooks and Telegram commands.                  |
| ⚡ **Rate Limiting**         | KV-backed rate limiter (10 trades/min) survives cold starts. Falls back to in-memory when KV unavailable. Prevents API bans and accidental trade spamming. |
| 📄 **Automated PDF Reports** | Twice-daily PDF portfolio reports via Cloudflare Browser Rendering. Styled HTML → PDF, stored in R2, delivered via Telegram. Free 10 min/day on all plans.  |

### Developer Experience

| Feature                | Description                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📊 **Command Center**  | Next.js 16 dashboard deployed to Cloudflare Workers via OpenNext. Real-time portfolio monitoring, win rates, live positions, and risk settings—no redeployment to change configuration. |
| 🖥️ **Interactive TUI** | Terminal-based process manager (`./hoox-tui`) for local development. Hot-reload all 9 workers simultaneously with one command.                                                          |
| 🛠️ **CLI Workspaces**  | Bun workspace monorepo managed via `hoox` CLI (15 command groups, 50+ subcommands, 381 tests). Interactive setup wizard, env config, KV sync, D1 ops, health monitoring, repair, and more.       |
| 🐳 **Docker Support**  | Full local dev environment with Docker Compose. `hoox dev start` prompts for Native vs Docker runtime, offers `--runtime` flag override. Profiles: `workers`, `dashboard`, `full`.                   |

### Security

| Feature                        | Description                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔒 **Zero Trust Architecture** | Internal workers (`trade-worker`, `d1-worker`) have zero public endpoints—accessible only via Cloudflare® Service Bindings.                           |
| 🛡️ **WAF Integration**         | IP allowlisting and rate limiting at the Cloudflare edge. Malicious traffic dropped before hitting the gateway worker.                                |
| 🔑 **Secret Injection**        | API keys injected directly into the V8 isolate at runtime. Never stored in plaintext, never logged. Local `.dev.vars` excluded from version control.  |
| 🏴 **Global Kill Switch**      | Instant trading halt via KV toggle. No redeployment, no downtime—immediate effect across all workers on next request cycle.                           |
| 🔐 **Security Headers**        | Full CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy on every response. CORS disabled (same-origin only). |

---

## 💸 Free Tier Costs

Hoox runs entirely on Cloudflare® Workers Free tier:

| Service                    | Free Limit                    | Notes                                |
| -------------------------- | ----------------------------- | ------------------------------------ |
| 🟠 Workers                 | 100k req/day                  | ~3k trades/day                       |
| 🟠 D1                      | 5M rows read, 100k writes/day | 5GB storage                          |
| 🟠 KV                      | 1GB, 1k ops/day               | Config + rate limiter state          |
| 🟠 R2                      | 10GB/month                    | Trade reports, logs, PDFs            |
| 🟠 Queues                  | 10k ops/day                   | ~3k trades/day                       |
| 🟠 Durable Objects         | SQLite-backed only            | Idempotency locks                    |
| 🟠 Workers AI              | 10k neurons/day               | AI summaries, risk analysis          |
| 🟠 Vectorize               | 100 indexes                   | RAG-powered AI responses             |
| 🟠 Browser Rendering       | 10 min/day                    | PDF portfolio reports                |
| 🟠 Analytics Engine        | Unlimited datasets            | Real-time API + trade observability  |
| 🟠 Smart Placement         | Unlimited                     | 30-60% latency reduction             |
| 🟠 WAF + Rate Limiting     | 1 free rate limit rule        | API protection                       |

---

## 🧪 Testing & Reliability

With money on the line, we test everything. Built natively on Bun, Hoox features TypeScript strict mode and 80%+ coverage targets.

```bash
bun test --coverage
```

See [AGENTS.md](AGENTS.md#testing) for testing modes (unit, integration, live), CI pipeline, and coverage details. See [DESIGN.md](DESIGN.md#10-service-binding-map) for the full service binding architecture.

---

## 🤝 Contribute

Traditional algorithmic trading is often complex and difficult to deploy. Hoox aims to simplify this.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/new-strategy`)
3. Commit your changes (`git commit -m 'Add new strategy'`)
4. Push to the branch (`git push origin feature/new-strategy`)
5. Open a Pull Request

---

## 📄 License

Licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). See [LICENSE](LICENSE) for the full license text and [DISCLAIMER](DISCLAIMER.md) for legal terms.

---

<div align="center">
Built with 🔥 on the Cloudflare® Edge.
</div>

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._
_Pine Script™ and TradingView® are trademarks of TradingView, Inc. This project is an independent effort and is not affiliated with or endorsed by TradingView, Inc._
