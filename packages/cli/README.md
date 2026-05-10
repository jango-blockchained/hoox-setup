# @jango-blockchained/hoox-cli

Hoox CLI — manage Cloudflare Workers, infrastructure, secrets, and deployments.

## Features

- **Interactive TUI**: Launch an interactive terminal UI when running `hoox` with no arguments
- **Worker Management**: Initialize, develop, and deploy Cloudflare Workers
- **Infrastructure as Code**: Manage D1 databases, R2 storage, KV namespaces, and more
- **Configuration**: Centralized config management via `wrangler.jsonc`
- **Secret Management**: Securely manage and deploy secrets to Cloudflare
- **Health Checks**: Verify setup and diagnose issues with `check-setup`
- **Logging**: Stream and filter worker logs
- **WAF Management**: Configure Cloudflare Web Application Firewall rules
- **Dashboard**: Launch and manage the Next.js dashboard

## Installation

### Global Install (Recommended)

```bash
# Using bun (recommended)
bun add -g @jango-blockchained/hoox-cli

# Using npm
npm install -g @jango-blockchained/hoox-cli
```

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
```

## Available Commands

| Command          | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| `hoox`           | Launch interactive TUI (when called with no arguments)      |
| `hoox init`      | Initialize a new Hoox project with worker configuration     |
| `hoox dev`       | Start local development environment for all workers         |
| `hoox deploy`    | Deploy workers to Cloudflare                                |
| `hoox infra`     | Manage infrastructure (D1, R2, KV, Durable Objects, Queues) |
| `hoox config`    | View and modify `wrangler.jsonc` configuration               |
| `hoox check`     | Verify project setup and diagnose issues                    |
| `hoox logs`      | Stream and filter Cloudflare Worker logs                    |
| `hoox test`      | Run tests for workers and packages                          |
| `hoox waf`       | Manage Cloudflare WAF rules and policies                    |
| `hoox clone`     | Clone and set up an existing Hoox project                   |
| `hoox dashboard` | Launch or deploy the Next.js dashboard                      |

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

Interactive prompts will guide you through setting up your project with the necessary worker configurations.

### Start Development Environment

```bash
hoox dev
```

Starts all workers locally with hot-reload. Each worker runs on a dedicated port (see `wrangler.jsonc` for port assignments).

### Deploy to Cloudflare

```bash
# Deploy all workers
hoox deploy

# Deploy specific worker
hoox deploy --worker hoox
```

### Check Project Setup

```bash
hoox check
```

Verifies that all dependencies, configurations, and Cloudflare credentials are properly set up.

### Manage Infrastructure

```bash
# List all infrastructure resources
hoox infra list

# Create a new D1 database
hoox infra create d1 my-database
```

### Manage Secrets

```bash
# Update secrets in Cloudflare
hoox config secrets update-cf
```

### View Logs

```bash
# Stream logs from all workers
hoox logs

# Filter logs by worker
hoox logs --worker trade-worker
```

### JSON Output for Scripting

```bash
hoox check --json
# Output: {"status": "ok", "checks": [...]}
```

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
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

# Run tests with coverage
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
│   ├── commands/             # Command implementations
│   │   ├── init/
│   │   ├── dev/
│   │   ├── deploy/
│   │   ├── infra/
│   │   ├── config/
│   │   ├── check/
│   │   ├── logs/
│   │   ├── test/
│   │   ├── waf/
│   │   ├── clone/
│   │   └── dashboard/
│   ├── ui/                   # Interactive TUI
│   └── utils/                # Shared utilities
│       ├── errors.ts
│       ├── formatters.ts
│       └── theme.ts
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
| `jsonc-parser`                    | Parse `wrangler.jsonc` configuration files          |
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
