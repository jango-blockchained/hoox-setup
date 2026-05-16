---
title: "⚙️ DevOps Manual"
description: "Infrastructure, deployment, and operations reference for Hoox operators"
---

# ⚙️ DevOps Manual

> Infrastructure provisioning, deployment sequences, secret management, and operations for the Hoox edge trading platform.

**For end-user documentation:** See [User Guide](../home.md)

---

## 📋 Operations Guide

- [Complete Setup & Operations](setup_and_operations.md) — Full system setup, environment matrix, deployment sequence, repair procedures, troubleshooting
- [TUI Operations](tui.md) — Terminal UI for monitoring, service management, and configuration

## 🏗️ Architecture

- [System Overview](architecture/overview.md)
- [Worker Communication](architecture/communication.md)
- [Data Flow](architecture/data-flow.md)
- [Bindings & Environment](architecture/bindings.md)

## ⚙️ Workers

- [hoox Gateway](workers/hoox.md)
- [trade-worker](workers/trade-worker.md)
- [agent-worker](workers/agent-worker.md)
- [telegram-worker](workers/telegram-worker.md)
- [d1-worker](workers/d1-worker.md)
- [web3-wallet-worker](workers/web3-wallet-worker.md)
- [email-worker](workers/email-worker.md)
- [analytics-worker](workers/analytics-worker.md)
- [report-worker](workers/report-worker.md)
- [dashboard](workers/dashboard.md)

## 🚢 Deployment

- [Production Setup](deployment/production.md)
- [CI/CD Pipeline](deployment/cicd.md)
- [Monitoring](deployment/monitoring.md)

## 💻 Development

- [Local Development](development/local-dev.md)
- [Testing](development/testing.md)
- [Debugging](development/debugging.md)

## 🔌 API Reference

- [Endpoints](api/endpoints.md)
- [Payloads](api/payloads.md)
- [Responses](api/responses.md)

## 📚 Reference

- [CLI Features](cli_features.md)
- [Bindings Reference](bindings.md)
- [Storage Architecture](storages.md)
- [Endpoints Reference](endpoints.md)
- [Zero Trust Setup](zero_trust_setup.md)
