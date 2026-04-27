# 📚 Hoox Documentation

> Comprehensive guide to the Hoox Cloudflare® Edge Worker Platform

## 📖 Table of Contents

### Getting Started

- [Installation](getting-started/installation.md)
- [Installation Flow](getting-started/installation-flow.md)
- [Quick Start Guide](getting-started/quick-start.md)
- [Configuration](getting-started/configuration.md)

### Architecture

- [System Overview](architecture/overview.md)
- [Worker Communication](architecture/communication.md)
- [Data Flow](architecture/data-flow.md)
- [Bindings & Environment](architecture/bindings.md)

### Workers

Each worker has its own README in the worker directory:

- [hoox Gateway](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/hoox) - Main gateway worker (65% line coverage)
- [trade-worker](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/trade-worker) - Trading engine (80% line coverage)
- [telegram-worker](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/telegram-worker) - Telegram bot & notifications (94% line coverage)
- [d1-worker](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/d1-worker) - Database operations (94% line coverage)
- [agent-worker](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/agent-worker) - Autonomous AI & Risk Manager (68% line coverage)
- [dashboard](https://github.com/jango-blockchained/hoox-setup/tree/main/pages/dashboard) - UI & Settings Manager
- [web3-wallet-worker](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/web3-wallet-worker) - Web3 interactions (83% line coverage)
- [home-assistant-worker](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/home-assistant-worker) - Home automation (76% line coverage)
- [email-worker](https://github.com/jango-blockchained/hoox-setup/tree/main/workers/email-worker) - Email processing (97% line coverage)

### API Reference

- [Endpoints](api/endpoints.md)
- [Payloads](api/payloads.md)
- [Responses](api/responses.md)

### Development

- [Local Development](development/local-dev.md)
- [Testing](development/testing.md)
- [Debugging](development/debugging.md)

### Deployment

- [Production Setup](deployment/production.md)
- [CI/CD](deployment/cicd.md)
- [Monitoring](deployment/monitoring.md)

## 🔗 Quick Links

- [Live Demo](https://hoox.cryptolinx.workers.dev)
- [GitHub Repository](https://github.com/jango-blockchained/hoox-setup)
- [Report Issues](https://github.com/jango-blockchained/hoox-setup/issues)

## 📊 Feature Matrix

| Feature         | hoox | trade | telegram | agent | dash | d1  | web3 | pages |
| --------------- | ---- | ----- | -------- | ----- | ---- | --- | ---- | ---- |
| API Key Auth    | ✅   | ✅    | ✅       | -     | -    | -   | ✅   | -    |
| IP Allow-list   | ✅   | -     | -        | -     | -    | -   | -    | -    |
| Service Binding | -    | ✅    | ✅       | ✅    | -    | -   | -    | -    |
| D1 Storage      | -    | ✅    | -        | ✅    | -    | ✅  | -    | -    |
| R2 Storage      | -    | ✅    | ✅       | -     | -    | -   | ✅   | -    |
| KV Storage      | ✅   | ✅    | ✅       | ✅    | ✅   | -   | -    | ✅   |
| AI/Vectorize    | -    | -     | ✅       | ✅    | -    | -   | -    | -    |
| Cron Triggers   | -    | -     | -        | ✅    | -    | -   | -    | -    |
| Cloudflare Pages | -   | -     | -        | -     | ✅   | -   | -    | ✅   |


---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
