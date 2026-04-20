# 📚 Hoox Documentation

> Comprehensive guide to the Hoox Cloudflare Edge Worker Platform

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

- [hoox Gateway](../workers/hoox/README.md) - Main gateway worker (81% coverage)
- [trade-worker](../workers/trade-worker/README.md) - Trading engine (82% coverage)
- [telegram-worker](../workers/telegram-worker/README.md) - Telegram bot & notifications
- [d1-worker](../workers/d1-worker/README.md) - Database operations
- [agent-worker](../workers/agent-worker/README.md) - Autonomous AI & Risk Manager
- [dashboard-worker](../workers/dashboard-worker/README.md) - UI & Settings Manager
- [web3-wallet-worker](../workers/web3-wallet-worker/README.md) - Web3 interactions
- [home-assistant-worker](../workers/home-assistant-worker/README.md) - Home automation
- [email-worker](../workers/email-worker/README.md) - Email processing

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

| Feature         | hoox | trade | telegram | agent | dash | d1  | web3 |
| --------------- | ---- | ----- | -------- | ----- | ---- | --- | ---- |
| API Key Auth    | ✅   | ✅    | ✅       | -     | -    | -   | ✅   |
| IP Allow-list   | ✅   | -     | -        | -     | -    | -   | -    |
| Service Binding | -    | ✅    | ✅       | ✅    | -    | -   | -    |
| D1 Storage      | -    | ✅    | -        | ✅    | -    | ✅  | -    |
| R2 Storage      | -    | ✅    | ✅       | -     | -    | -   | ✅   |
| KV Storage      | ✅   | ✅    | ✅       | ✅    | ✅   | -   | -    |
| AI/Vectorize    | -    | -     | ✅       | ✅    | -    | -   | -    |
| Cron Triggers   | -    | -     | -        | ✅    | -    | -   | -    |
