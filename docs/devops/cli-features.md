---
title: "CLI Architecture & Features"
description: "Detailed specification of the Hoox Command-Line Interface, monorepo workspaces compilation, and task-management engines."
---

# 🛠️ CLI Architecture & Features

The **`hoox` CLI** (`packages/cli`) is the unified lifecycle engine of the trading platform monorepo. It governs local sandboxes, compiles TypeScript structures, coordinates Cloudflare infrastructure resources, deploys edge isolates, manages encrypted secrets, and executes self-healing diagnostics.

---

## 🏗️ Monorepo Workspace Design

The CLI is integrated into our monorepo using **Bun Workspaces**, which link local packages together. This design ensures that the CLI binary can resolve and load local shared types (`@jango-blockchained/hoox-shared`) and TUI components (`packages/tui`) instantly without network downloads or pre-compilation overhead:

```
hoox-setup/ (Monorepo Root)
├── packages/
│   ├── cli/       # CLI Source code (entry binary: bin/hoox.js)
│   ├── tui/       # OpenTUI dashboard source code
│   └── shared/    # Common libraries (auth, router, error models)
├── workers/
│   └── ...        # Edge V8 isolates
└── package.json   # Root workspace manager
```

---

## ⚡ 1. Command-Line Core Architectures

The CLI binary parses terminal instructions using the following architectural layers:

### A. Command Dispatcher (`packages/cli/src/index.ts`)

Intercepts all incoming arguments (e.g. `hoox infra provision`), evaluates global flags (`--json`, `--quiet`), validates configuration integrity, and delegates execution to target command modules under `src/commands/`.

### B. Cloudflare API Adapters (`src/adapters/`)

Translates command intentions (like `hoox infra d1 create`) into parameterized Cloudflare API REST payloads, bypassing wrangler wrappers when high-performance execution is needed.

### C. State Engine (`src/core/`)

Tracks active project profiles, enabled worker matrices, and workspace configuration formats (`wrangler.jsonc` vs. `wrangler.toml`).

---

## 🔒 2. Declarative Config Mapping & Validation

To prevent configuration drift, the CLI enforces strict type validation on `wrangler.jsonc` files:

1. **Config Interfaces**: Built-in parsers validate configuration files against type-safe TypeScript interfaces (`Config` and `WorkerConfig`) defined in `src/core/types.ts`.
2. **Setup Verification (`hoox check setup`)**: Compares active workspace profiles against example files, audits environment variables keys, and scans for missing bindings, outputting formatted terminal reports.

---

## 🛜 3. Self-Healing & Diagnostics Engine

One of the CLI's most powerful features is its **guided repair framework** (`hoox repair` command groups):

- **Diagnostic Probes**: The `hoox repair check` command runs a 5-step checklist (verifying submodule checkouts, NPM/Bun package resolutions, TypeScript variables, Cloudflare zone links, and encrypted credentials).
- **Automated Recovery**: If a missing resource is identified (e.g. a D1 database ID is bound in `wrangler.jsonc` but the database doesn't exist on your Cloudflare account), the repair engine prompts you and provisions it automatically:

```bash
# Provision missing Cloudflare bindings and repair system states
hoox repair infra
```

---

> **Tip:** Every single command supports the `--json` global flag. This outputs machine-parseable JSON payloads (e.g. `hoox monitor status --json`), allowing you to integrate the CLI with external telemetry dashboards or alert scripts effortlessly!

### 🔗 Next Steps

- **[CLI Reference Manual](../../enduser/reference/cli-commands.md)** — Review the complete command tree, positional arguments, and flags.
- **[Wrangler Setup & Tooling](development/local-dev.md)** — Configure Wrangler to bind local D1 and KV instances for dev testing.
