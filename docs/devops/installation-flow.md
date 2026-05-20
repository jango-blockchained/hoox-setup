---
title: "Cloudflare® Workers Setup Flow"
description: "Detailed system onboarding, toolchain validation steps, wrangler.jsonc schemas, and Secret Store binding architectures."
---

# 🚀 Cloudflare® Workers Setup Flow

This document details the step-by-step installation, bootstrapping, and validation workflows executed by the Hoox CLI during project initialization.

> **Developer Note:** The Hoox CLI enforces strict type validation for all configuration files via the `Config` and `WorkerConfig` TypeScript interfaces defined in `packages/cli/src/core/types.ts`. Avoid using `as any` or type bypasses when extending wrangler parameters to prevent build-time CLI crashes.

---

## 🏗️ Interactive Setup Wizard (`hoox init`)

To start the system bootstrap, run the init wizard from the monorepo root:

```bash
hoox init
```

The setup wizard guides you through 7 critical onboarding phases:

### Phase 1: Toolchain Diagnostics

Probes your machine to verify that essential developer tools are accessible:

- **Bun**: Used for monorepo package management, CLI binaries execution, and fast unit testing.
- **Git**: Used to verify recursive cloning of worker submodules.
- **Wrangler**: Cloudflare's CLI used to login, tail logs, and upload V8 isolates.

---

### Phase 2: Global Configuration Mapping

Configures your master workspace credentials stored in `.env.local` and `wrangler.jsonc`:

- **Cloudflare API Token**: Generates and checks permissions.
- **Cloudflare Account ID**: Uniquely identifies your hosting space.
- **Subdomain Prefix**: Defines the worker routing domain (e.g. `hoox` routes to `https://hoox.alpha-trading.workers.dev`).

---

### Phase 3: Microservice Profile Selection

Lets you selectively enable or disable specific workers from the `workers/` directory based on your trading intent (e.g., cross-margin futures execution vs. Web3 DeFi wallet swaps). Disabling unnecessary workers saves deployment bandwidth and keeps resource bindings clean.

---

### Phase 4: SQLite Database Provisioning

Checks if enabled workers require persistent D1 storage. If yes, it creates the database and initializes database schemas:

```bash
# Done automatically by the wizard
wrangler d1 create trade-data-db
```

---

### Phase 5: Manifest Compilation

Consolidates all chosen parameters and writes your central `wrangler.jsonc` file, mapping out variables and bindings for every worker.

---

### Phase 6: Workers Secrets Injection

Secures sensitive credentials (exchange API keys, Telegram tokens, AI API keys) by encrypting and uploading them to Cloudflare as encrypted Workers Secrets.

---

### Phase 7: Initial Rollout

Compiles, lint-checks, type-checks, and deploys all enabled workers to Cloudflare's edge in the correct mathematical dependency sequence.

---

## 🔎 Configuration Files Spec

The Hoox platform uses a dual configuration file architecture to track workspace states:

### A. wrangler.jsonc (Central Settings)

This file represents the declarative single source of truth for your monorepo's active workers:

```jsonc
{
  "global": {
    "cloudflare_account_id": "debc6545e63bea36be059cbc82d80ec8",
    "subdomain_prefix": "hoox",
  },
  "workers": {
    "d1-worker": {
      "enabled": true,
      "path": "workers/d1-worker",
      "vars": { "database_name": "trade-data-db" },
    },
    "trade-worker": {
      "enabled": true,
      "path": "workers/trade-worker",
      "secrets": ["BYBIT_API_KEY", "BYBIT_API_SECRET", "TELEGRAM_BOT_TOKEN"],
    },
  },
}
```

---

### B. .install-wizard-state.json (Onboarding State)

During the interactive setup, the CLI caches your current step and intermediate inputs inside `.install-wizard-state.json` at your project root.

- **State Recovery**: If your terminal session is disconnected or wrangler login prompts timeout, you can run `hoox init` again. The CLI will detect the state file and seamlessly resume your onboarding from the last incomplete step.
- **Auto-Cleanup**: Upon final completion of Phase 7, the state file is automatically purged to keep your root directory clean.

---

## 🔒 Secret Bindings Architecture

Hoox utilizes Cloudflare's hardware-secured **Secret Store** to bind environment credentials to V8 isolates without exposing them in git history.

### Local Mocking (`.dev.vars`)

During local development, wrangler dev looks for a local, gitignored file called `.dev.vars` inside each worker's directory to simulate secrets:

```bash
# workers/trade-worker/.dev.vars
BYBIT_API_KEY=mock_bybit_development_key
BYBIT_API_SECRET=mock_bybit_development_secret
```

---

### Production Secret Bindings

When deploying to production, wrangler binds these variables using direct encrypted environments in your worker's wrangler configuration:

```json
{
  "secrets_store": {
    "bindings": [
      {
        "binding": "BYBIT_API_KEY_BINDING",
        "store_id": "48433bc559a943f09d9d6c622e188fd5",
        "secret_name": "BYBIT_API_KEY"
      }
    ]
  }
}
```

This guarantees that secrets are never logged, never cached in plain text on disk, and are only accessible inside your worker's sandboxed execution isolate memory.

---

> **Tip:** Made a configuration mistake or changed your subdomain? You can re-run `hoox check-setup` at any time to execute high-integrity type validation and ensure all bindings and configurations match production examples perfectly!

### 🔗 Next Steps

- **[DevOps Setup & Operations Manual](setup_and_operations.md)** — Dive into complete operations, variable matrices, and troubleshooting.
- **[Terminal UI Cockpit](tui.md)** — Run, hot-reload, and monitor your local workers via TUI.
