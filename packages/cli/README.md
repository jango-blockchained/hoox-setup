# @jango-blockchained/hoox-cli

> **See also:** [Hoox User Guide](../docs/home.md) · [CLI Command Reference](../docs/reference/cli-commands.md)

> Hoox CLI — manage Cloudflare Workers, infrastructure, secrets, and deployments.

> **Runtime requirement:** Bun ≥ 1.2. The bin shebang and bundle target are Bun-only; `npm install -g` will install the package but the CLI will not run under Node.js.

528 unit tests, 21 command groups, 60+ subcommands.

## Features

- **Interactive Setup**: `hoox init` guides you through project initialization with AI provider support
- **Infrastructure as Code**: Manage D1, KV, R2, Queues, Vectorize, and Analytics via `hoox infra`
- **Environment Management**: Declarative 27-key env matrix via `hoox config env`
- **KV Config Sync**: 16-key manifest with `apply-manifest` for CONFIG_KV
- **Database Operations**: Schema apply, migrations, query, export, reset via `hoox db`
- **Deploy Automation**: Workers + dashboard + telegram webhook + KV config in one flow
- **Operational Monitoring**: Health checks, recent trades, kill switch, queue depth, backup
- **Repair & Recovery**: Comprehensive system check, guided rebuild, per-component repair
- **Prerequisites Checks**: 7 tool/account/repository validations
- **Secret Management**: Sync, check, and rotate Cloudflare secrets
- **Interactive TUI**: Launch an interactive terminal UI when running `hoox` with no arguments
- **Worker Management**: Initialize, develop, and deploy Cloudflare Workers

## Installation

### Global Install (Recommended)

```bash
# Using bun (the only supported runtime)
bun add -g @jango-blockchained/hoox-cli
```

> The CLI is a Bun bundle — `npm install -g` will not produce a working binary.

### Local Development

```bash
cd packages/cli
bun install
bun run build
```

## Quick Start

```bash
# Launch interactive TUI (no arguments)
hoox

# Or use specific commands
hoox --help
hoox init
hoox dev
hoox deploy
hoox monitor status
```

## Available Commands

| Command           | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `hoox init`       | Initialize a new Hoox project with worker configuration          |
| `hoox setup`      | Auto-bootstrap infrastructure (auth, keys, D1, secrets)          |
| `hoox clone`      | Clone worker repositories as git submodules                      |
| `hoox dev`        | Start local development environment for all workers              |
| `hoox deploy`     | Deploy workers, dashboard, telegram webhook, and KV config       |
| `hoox infra`      | Manage infrastructure (D1, KV, R2, Queues, Vectorize, Analytics) |
| `hoox config`     | Manage wrangler.jsonc, env vars, KV keys, and secrets            |
| `hoox check`      | Validate setup, prerequisites, and worker health                 |
| `hoox db`         | Manage D1 databases (apply, migrate, query, export, reset)       |
| `hoox monitor`    | Monitor health, trades, logs, kill switch, queue, backup         |
| `hoox workers`    | Per-worker operations (list, status, dev, logs)                  |
| `hoox repair`     | Diagnose and repair the system (check, rebuild, per-component)   |
| `hoox schema`     | Manage D1 schema and migrations                                  |
| `hoox update`     | Self-update the CLI and check wrangler versions                  |
| `hoox logs`       | Stream and filter Cloudflare Worker logs                         |
| `hoox test`       | Run tests and CI pipeline                                        |
| `hoox waf`        | Manage Cloudflare WAF rules and policies                         |
| `hoox dashboard`  | Launch or deploy the Next.js dashboard                           |
| `hoox tui`        | Launch the OpenTUI terminal dashboard                            |
| `hoox agent`      | AI agent operations (health probe)                               |
| `hoox disclaimer` | Display legal disclaimer                                         |
| `hoox completion` | Generate shell completion script (bash, zsh, fish)               |

### Global Options

All commands support these global options:

| Option    | Description                                  |
| --------- | -------------------------------------------- |
| `--json`  | Output in JSON format (useful for scripting) |
| `--quiet` | Minimal output mode                          |

## Usage Examples

### Initialize a New Project

```bash
hoox init
```

Interactive prompts guide you through AI provider setup, Cloudflare credentials, and exchange API keys.

### Check Prerequisites

```bash
# Check all tools
hoox check prerequisites

# Check specific tool
hoox check prerequisites --tool bun
```

Validates bun ≥1.2, git ≥2.40, wrangler, Docker, Cloudflare auth, and repository integrity.

### Configure Environment

```bash
# Interactive env setup (all 27 vars across 8 sections)
hoox config env init

# Show current env (secrets redacted)
hoox config env show

# Validate required vars
hoox config env validate

# Generate per-worker .dev.vars
hoox config env generate-dev-vars
```

### Manage KV Keys

```bash
# Apply manifest defaults (16 keys)
hoox config kv apply-manifest

# Show expected manifest
hoox config kv manifest

# Individual key operations
hoox config kv list
hoox config kv get trade:kill_switch
hoox config kv set trade:kill_switch "false"
hoox config kv delete trade:kill_switch
```

### Deploy to Cloudflare

```bash
# Deploy all workers then dashboard
hoox deploy all

# Deploy all — skip rebuild prompt, use existing build
hoox deploy all --auto

# Deploy with force rebuild
hoox deploy all --rebuild

# Post-deploy: set Telegram webhook
hoox deploy telegram-webhook

# Post-deploy: update dashboard service URLs
hoox deploy update-internal-urls

# Post-deploy: apply KV manifest
hoox deploy kv-config

# Deploy specific worker
hoox deploy worker trade-worker
```

### Manage Database

```bash
# Apply schema to local or remote
hoox db apply
hoox db apply --remote

# Run tracking migrations
hoox db migrate --remote

# List tables
hoox db list --remote

# Execute read-only queries
hoox db query "SELECT COUNT(*) FROM trades" --remote

# Export to timestamped .sql
hoox db export

# Reset D1 (DESTRUCTIVE)
hoox db reset --confirm
```

### Manage Infrastructure

```bash
# Auto-provision from wrangler.jsonc
hoox infra provision

# Individual resource management
hoox infra d1 list
hoox infra kv create my-namespace
hoox infra r2 list
hoox infra queues create my-queue
hoox infra vectorize list
hoox infra vectorize create my-index
hoox infra analytics list
```

### Monitor Operations

```bash
# Check all worker health endpoints
hoox monitor status

# Show recent trades
hoox monitor trades 20

# Show system logs
hoox monitor logs
hoox monitor logs hoox

# Kill switch operations
hoox monitor kill-switch show
hoox monitor kill-switch on     # Halt all trading
hoox monitor kill-switch off    # Resume trading

# Queue depth
hoox monitor queue-depth

# Backup D1 database
hoox monitor backup
```

### Repair and Recovery

```bash
# Comprehensive system check (5 steps)
hoox repair check

# Redeploy a single worker
hoox repair worker trade-worker

# Verify infrastructure exists
hoox repair infra

# Re-upload all secrets
hoox repair secrets

# Reset KV keys to defaults
hoox repair kv

# Re-apply schema + migrations
hoox repair db

# Full guided rebuild (interactive, WARNING: destructive)
hoox repair rebuild
```

### JSON Output for Scripting

```bash
hoox check prerequisites --json
hoox monitor status --json
hoox infra d1 list --json
```

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) >= 1.2
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Wrangler CLI (installed automatically with dependencies)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/jango-blockchained/hoox-setup.git
cd hoox-setup

# Install dependencies
bun install

# Build the CLI
cd packages/cli
bun run build
```

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage

# Run specific test file
bun test path/to/test.test.ts
```

### Linting and Type Checking

```bash
# Lint code
bun run lint

# Type check
bun run typecheck
```

### CI Pipeline

The CI pipeline runs in this order:

1. `bun run lint` — ESLint check
2. `bun run typecheck` — TypeScript check (`tsc --noEmit`)
3. `bun test packages/cli --coverage` — Run tests with coverage (80% threshold)
4. `bun run build` — TypeScript build check

## Project Structure

```
packages/cli/
├── src/
│   ├── index.ts              # Main entry point
│   ├── commands/
│   │   ├── init/             # Interactive setup wizard
│   │   ├── setup/            # Auto-bootstrap infrastructure
│   │   ├── dev/              # Local development
│   │   ├── deploy/           # Deploy, telegram-webhook, update-internal-urls
│   │   ├── infra/            # D1, KV, R2, Queues, Vectorize, Analytics
│   │   ├── config/           # Wrangler config, env, kv, secrets
│   │   ├── check/            # Prerequisites, setup, health
│   │   ├── db/               # Database operations
│   │   ├── monitor/          # Health, trades, logs, kill-switch
│   │   ├── workers/          # Per-worker operations
│   │   ├── repair/           # Check, worker, infra, secrets, rebuild
│   │   ├── schema/           # Schema management
│   │   ├── update/           # Self-update
│   │   ├── logs/             # Worker log tailing
│   │   ├── test/             # CI pipeline
│   │   ├── waf/              # WAF management
│   │   ├── clone/            # Submodule cloning
│   │   ├── dashboard/        # Dashboard operations
│   │   ├── tui/              # TUI launcher
│   │   ├── agent/            # AI agent operations
│   │   └── disclaimer/       # Legal disclaimer
│   ├── services/
│   │   ├── cloudflare/       # Wrangler CLI wrapper
│   │   ├── config/           # wrangler.jsonc reader
│   │   ├── db/               # D1 operations
│   │   ├── docker/           # Docker compose wrapper
│   │   ├── env/              # Environment definitions
│   │   ├── kv/               # KV key management
│   │   ├── prerequisites/    # Tool version checks
│   │   └── secrets/          # Secret management
│   ├── ui/                   # Interactive TUI
│   └── utils/                # Errors, formatters, theme
├── bin/
│   └── hoox.js              # CLI binary entry point
├── package.json
└── README.md
```

## Key Dependencies

| Package                           | Purpose                                            |
| --------------------------------- | -------------------------------------------------- |
| `commander`                       | CLI framework for command registration and parsing |
| `@clack/prompts`                  | Interactive prompts for the TUI                    |
| `ansis`                           | Terminal styling and colors                        |
| `jsonc-parser`                    | Parse `wrangler.jsonc` configuration files         |
| `@jango-blockchained/hoox-shared` | Shared types and utilities                         |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code passes linting, type checking, and all tests before submitting.

## License

MIT License

Copyright (c) 2026 Hoox Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Links

- [GitHub Repository](https://github.com/jango-blockchained/hoox-setup)
- [Issue Tracker](https://github.com/jango-blockchained/hoox-setup/issues)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
