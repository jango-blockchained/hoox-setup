# Hoox Worker Project

[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare%20Edge%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![Database](https://img.shields.io/badge/Database-Cloudflare%20D1%2C%20KV%2C%20R2%2C%20Vectorize-orange?logo=cloudflare)](https://developers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

This project contains a collection of Cloudflare Workers managed by a unified TypeScript-based CLI tool, designed to work together via service bindings and other Cloudflare platform features.

## Prerequisites

- **Bun:** This project uses Bun as the JavaScript runtime and package manager. Follow the installation instructions at [https://bun.sh/](https://bun.sh/).
- **Node.js:** While Bun is the primary runtime, some Node.js APIs might be used (especially by underlying Wrangler commands). Ensure you have a recent LTS version installed.
- **Cloudflare Account:** You need a Cloudflare account ID and an API token with appropriate permissions (e.g., Workers, D1, R2, KV, Vectorize, AI, Secrets).
- **Wrangler:** Ensure the Cloudflare Wrangler CLI is installed and authenticated (`npm install -g wrangler && wrangler login`).
- **Cloudflare Worker Subdomain:** Ensure you have configured your desired Workers subdomain (e.g., `your-subdomain.workers.dev`) in your Cloudflare account settings under Workers & Pages > Overview.
- **Cloudflare Resources:** Depending on the workers you enable, you might need to pre-create D1 databases, R2 buckets, KV namespaces, or Vectorize indexes using Wrangler commands before running the setup/deploy steps.

## Project Structure

```
.
├── .cursor/
├── .keys/                # Stores local API keys (gitignored)
│   └── local_keys.env
├── docs/                 # Project documentation (optional)
├── scripts/              # Management scripts
│   └── manage.ts         # The main CLI tool
├── src/                  # Shared utility code
│   └── tui/
│   └── utils/
├── workers/              # Individual Cloudflare Worker projects
│   ├── d1-worker/        # Example D1 database interaction worker
│   │   ├── src/
│   │   ├── test/
│   │   └── wrangler.jsonc
│   ├── home-assistant-worker/
│   │   └── ...
│   ├── telegram-worker/
│   │   └── ...
│   ├── trade-worker/
│   │   └── ...
│   ├── web3-wallet-worker/
│   │   └── ...
│   ├── webhook-receiver/ # Gateway worker using service bindings
│   │   └── ...
│   └── ...               # Other workers
├── .eslintrc.json
├── .gitignore
├── .gitmodules
├── .install-wizard-state.json
├── .prettierrc.json
├── bun.lockb             # Bun lockfile
├── bunfig.toml
├── config.toml           # Central configuration file
├── config.toml.example
├── hoox-tui              # Possibly a related TUI project?
├── LICENSE
├── package-lock.json
├── package.json          # Project dependencies (incl. workspace config)
├── README.md             # This file
├── TASKPLAN.md           # Project task tracking
└── tsconfig.json         # TypeScript configuration
```

## Configuration (`config.toml`)

This file is the central place to configure global settings and individual workers.

```toml
# config.toml Example

[global]
# Required global settings (wizard prompts if missing)
cloudflare_api_token = "YOUR_CLOUDFLARE_API_TOKEN"
cloudflare_account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
subdomain_prefix = "your-unique-prefix" # Used for resource naming conventions, etc.

# Optional: Path to a .env file for loading additional env vars for the management script
# dotenv_path = ".env"

[workers.d1-worker] # Example worker entry
enabled = false # Set to false to disable this worker during bulk operations
path = "workers/d1-worker" # Relative path to the worker directory
# Secrets this worker requires (will be prompted for during setup/wizard)
secrets = ["INTERNAL_KEY"] # Example
# Environment variables to set during deployment (URLs for service bindings are NOT needed here)
# vars = { SOME_CONFIG_VALUE = "abc" }
# Deployed URL (populated automatically by 'workers deploy')
# deployed_url = "..."

[workers.trade-worker]
enabled = true
path = "workers/trade-worker"
secrets = [
    "INTERNAL_KEY",
    "MEXC_API_KEY", "MEXC_API_SECRET",
    "BINANCE_API_KEY", "BINANCE_API_SECRET"
]
# vars = { DEFAULT_LEVERAGE = "20" }

[workers.telegram-worker]
enabled = true
path = "workers/telegram-worker"
secrets = [
    "INTERNAL_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID_DEFAULT",
    "TELEGRAM_WEBHOOK_SECRET"
]
# vars = {}

[workers.webhook-receiver]
enabled = true
path = "workers/webhook-receiver"
secrets = ["WEBHOOK_API_KEY", "INTERNAL_KEY"]
# vars = {}

# ... other worker configurations ...
```

### Key Management (`.keys/`)

- The `.keys/` directory stores sensitive API keys locally, primarily intended for **local development**.
- `local_keys.env`: Used for local development secrets (e.g., testnet keys). This file is gitignored. Create it manually or use `manage.ts keys generate`. The format is simple `KEY_NAME=VALUE` pairs.
- The `manage.ts secrets update-cf` command reads values from `local_keys.env` to upload them as Cloudflare secrets, which is useful for populating secrets needed for local development (`wrangler dev`).
- **Production Secrets:** Manage production secrets directly in the Cloudflare dashboard or using `wrangler secret put`. Do not commit production secrets.

## Initial Setup (Wizard)

For the first-time setup, use the interactive wizard:

```bash
bun install
bun run scripts/manage.ts init
```

The wizard will guide you through:

1.  **Dependency Check:** Verifies `bun` and `wrangler` are installed.
2.  **Global Settings:** Prompts for your Cloudflare Account ID, API Token, and a unique subdomain prefix if not found in `config.toml`.
3.  **Worker Selection:** Lists workers found in the `workers/` directory and asks which ones to enable in `config.toml`.
4.  **Resource Check/Creation (Basic):** May prompt to create essential resources like KV namespaces if needed by core functionality (check wizard implementation for details).
5.  **Configuration Save:** Writes the selected worker configurations and global settings to `config.toml`.
6.  **Secret Configuration:** For each enabled worker, checks the `secrets` array defined in `config.toml`.
    - It attempts to find the secret value in `process.env` or `.keys/local_keys.env`. If found, it offers to upload it using `wrangler secret put` (useful for `wrangler dev`). If not found, it prompts you to enter it for upload.
    - **Production Secrets:** Ensure production secrets are set directly in Cloudflare.
7.  **Initial Deployment (Optional):** Asks if you want to deploy the enabled workers immediately.

The wizard uses `.install-wizard-state.json` to save progress, allowing you to resume if interrupted.

## Management CLI (`scripts/manage.ts`)

Use `bun run scripts/manage.ts <command>` for ongoing management.

**Commands:**

- `init`
  - Runs the interactive first-time setup wizard (see above).

- `workers setup`
  - Configures all _enabled_ workers based on `config.toml`.
  - Updates `wrangler.jsonc` files (name, account ID, vars, bindings defined in the worker's README/source).
  - Prompts for missing secrets (checking env/local keys first) and uploads them using `wrangler secret put`.
  - Runs D1 migrations if a worker has a `migrations/` directory and a D1 binding.

- `workers deploy`
  - Deploys all _enabled_ workers using `wrangler deploy`.
  - Captures the deployed URL and saves it back to `config.toml` under the worker's `deployed_url` key.

- `workers dev <workerName>`
  - Starts a local development server for the specified worker using `wrangler dev`.
  - **Note:** Local development involving **Service Bindings** requires special setup. You might need to run multiple workers concurrently or mock the bindings. See [Cloudflare Docs](https://developers.cloudflare.com/workers/platform/bindings/service-bindings/local-development/).

- `workers status`
  - Displays a summary of all workers defined in `config.toml`, showing their enabled/disabled status, path, deployed URL (if known), and counts of vars/secrets.

- `workers test [workerName]`
  - Runs tests using `bun test` within the specified worker's directory (or all enabled workers if `workerName` is omitted). Assumes tests are in a `test/` subdirectory.
  - Supports `--coverage` and `--watch` flags passed to `bun test`.

- `keys generate <keyName>`
  - Generates a new secure random key and saves it to `.keys/local_keys.env`.

- `keys get <keyName>`
  - Retrieves and prints the value of a key from `.keys/local_keys.env`.

- `keys list`
  - Lists all keys stored in `.keys/local_keys.env`.

- `secrets update-cf <keyName> <workerName>`
  - Updates a Cloudflare secret for a specific worker, reading the value from `.keys/local_keys.env`.
  - Useful for setting secrets required by `wrangler dev` for local development.

## Development

To run a worker locally during development:

1.  Ensure the worker is enabled in `config.toml`.
2.  Make sure any necessary secrets are available for local development:
    - Place them in `.keys/local_keys.env` and use `bun run scripts/manage.ts secrets update-cf <keyName> <workerName>` to upload them to Cloudflare.
    - Or, define them directly in a `.dev.vars` file within the worker's directory (this overrides Cloudflare secrets during `wrangler dev`).
3.  Run the local development server:
    ```bash
    bun run scripts/manage.ts workers dev <workerName>
    ```
4.  If the worker uses Service Bindings, consult the Cloudflare documentation for local development strategies.

## Testing

Run tests using the management script:

```bash
# Test a specific worker
bun run scripts/manage.ts workers test trade-worker

# Test all enabled workers
bun run scripts/manage.ts workers test

# Run tests with coverage for all enabled workers
bun run scripts/manage.ts workers test --coverage
```

## Deployment

1.  Ensure workers are configured correctly (`bun run scripts/manage.ts workers setup`).
2.  Deploy all enabled workers:
    ```bash
    bun run scripts/manage.ts workers deploy
    ```

## Contributing

Contributions are welcome! Please follow standard fork/branch/PR procedures.
