# 📚 Hoox Documentation

> Comprehensive guide to the Hoox Cloudflare Edge Worker Platform

## 📖 Table of Contents

### Getting Started

- [Installation](getting-started/installation.md)
- [Quick Start Guide](getting-started/quick-start.md)
- [Configuration](getting-started/configuration.md)

### Architecture

- [System Overview](architecture/overview.md)
- [Worker Communication](architecture/communication.md)
- [Data Flow](architecture/data-flow.md)

### Workers

- [hoox Gateway](workers/hoox.md)
- [trade-worker](workers/trade-worker.md)
- [telegram-worker](workers/telegram-worker.md)
- [d1-worker](workers/d1-worker.md)
- [web3-wallet-worker](workers/web3-wallet.md)
- [home-assistant-worker](workers/home-assistant.md)

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

| Feature         | hoox | trade | telegram | d1  | web3 | ha  |
| --------------- | ---- | ----- | -------- | --- | ---- | --- |
| API Key Auth    | ✅   | ✅    | ✅       | -   | ✅   | ✅  |
| IP Allow-list   | ✅   | -     | -        | -   | -    | -   |
| Service Binding | -    | ✅    | ✅       | -   | -    | -   |
| D1 Storage      | -    | ✅    | -        | ✅  | -    | -   |
| R2 Storage      | -    | ✅    | ✅       | -   | ✅   | -   |
| KV Storage      | ✅   | ✅    | ✅       | -   | -    | ✅  |
| AI/Vectorize    | -    | -     | ✅       | -   | -    | -   |
