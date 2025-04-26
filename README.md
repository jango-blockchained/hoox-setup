# Hoox Worker Project

[![Language](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh)
[![Platform](https://img.shields.io/badge/Platform-Cloudflare%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![Database](https://img.shields.io/badge/Database-Cloudflare%20D1-orange?logo=cloudflare)](https://developers.cloudflare.com/d1/)
[![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

This project contains a collection of Cloudflare Workers managed by a unified TypeScript-based CLI tool.

## Prerequisites

- **Bun:** This project uses Bun as the JavaScript runtime and package manager. Follow the installation instructions at [https://bun.sh/](https://bun.sh/).
- **Node.js:** While Bun is the primary runtime, some Node.js APIs are used. Ensure you have a recent LTS version installed.
- **Cloudflare Account:** You need a Cloudflare account ID and an API token with appropriate permissions (e.g., Workers, D1, Secrets).
- **Cloudflare Worker Subdomain:** Ensure you have configured your desired Workers subdomain (e.g., `your-subdomain.workers.dev`) in your Cloudflare account settings under Workers & Pages > Overview.
- **Cloudflare D1 Database (If using `d1-worker`):** If you plan to enable the `d1-worker`, ensure a D1 database is created. The setup wizard (`manage.ts init`) or the `manage.ts workers setup` command can assist with this.

## Project Structure

```
.
├── .keys/                # Stores local/production API keys (gitignored)
│   ├── local_keys.env
│   └── prod_keys.env     # DEPRECATED: Use Cloudflare secrets directly for production.
├── docs/                 # Project documentation (optional)
├── scripts/              # Management scripts
│   └── manage.ts         # The main CLI tool
├── workers/              # Individual Cloudflare Worker projects
│   ├── d1-worker/        # Example: D1 database worker
│   │   ├── src/
│   │   ├── test/
│   │   └── wrangler.toml
│   ├── trade-worker/     # Example: Trading logic worker
│   │   └── ...
│   └── ...               # Other workers
├── config.toml           # Central configuration file
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── bun.lockb             # Bun lockfile
└── README.md             # This file
```

## Configuration (`config.toml`)

This file is the central place to configure global settings and individual workers.

```toml
# config.toml Example

[global]
# Required global settings (wizard prompts if missing)
cloudflare_api_token = "YOUR_CLOUDFLARE_API_TOKEN"
cloudflare_account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
subdomain_prefix = "your-unique-prefix" # Used for D1 naming, etc.

# Optional: Path to a .env file for loading additional env vars
# dotenv_path = ".env"

# Optional: Populated by the init wizard or manually
# d1_database_id = "your-d1-database-uuid"

[workers.d1-worker]
enabled = true # Set to false to disable this worker
path = "workers/d1-worker" # Relative path to the worker directory
# Secrets this worker requires (will be prompted for during setup/wizard)
secrets = []
# Environment variables to set during deployment (URLs are often set automatically)
# vars = { database_name = "your-d1-db-name" }
# Deployed URL will be populated by the deploy command
# deployed_url = "..."

[workers.trade-worker]
enabled = true
path = "workers/trade-worker"
secrets = ["EXCHANGE_API_KEY", "EXCHANGE_API_SECRET"]
# vars = { D1_WORKER_URL = "..." } # 'workers deploy' or 'workers update-internal-urls' updates this

[workers.telegram-worker]
enabled = false
path = "workers/telegram-worker"
secrets = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
# vars = {}
```

### Key Management (`.keys/`)

- The `.keys/` directory stores sensitive API keys locally, primarily intended for **local development**.
- `local_keys.env`: Used for local development secrets (e.g., testnet keys). This file is gitignored. Create it manually or use `keys generate`.
- `prod_keys.env`: **DEPRECATED.** Storing production keys locally, even if gitignored, is discouraged. **Manage production secrets directly in the Cloudflare dashboard or using `wrangler secret put`.**
- The format for `local_keys.env` is simple `KEY_NAME=VALUE` pairs.
- The `secrets update-cf` command (using `-e local`, the default) can read values from `local_keys.env` to upload to Cloudflare, which is useful for populating secrets needed for local development (`wrangler dev`).

## Initial Setup (Wizard)

For the first-time setup, use the interactive wizard:

```bash
bun install
bun run manage.ts init
```

The wizard will guide you through:

1.  **Dependency Check:** Verifies `bun` and `wrangler` are installed.
2.  **Global Settings:** Prompts for your Cloudflare Account ID, API Token, and a unique subdomain prefix if not found in `config.toml`.
3.  **Worker Selection:** Lists workers found in the `workers/` directory and asks which ones to enable.
4.  **D1 Database Setup:** If the `d1-worker` is enabled, prompts for a database name and runs `wrangler d1 create` to create it, storing the ID in `config.toml`.
5.  **Configuration Save:** Writes the selected worker configurations and global settings (including D1 ID) to `config.toml`.
6.  **Secret Configuration:** For each enabled worker, checks the `secrets` array defined in `config.toml`.
    *   **Local Secrets:** It attempts to find the secret value in `process.env` or `.keys/local_keys.env`. If found, it can be uploaded using `wrangler secret put` (useful for `wrangler dev`). If not found, it prompts you.
    *   **Production Secrets:** For production deployments, you should configure secrets **directly** in the Cloudflare dashboard or via `wrangler secret put`. The wizard does not handle production secrets.
7.  **Initial Deployment (Optional):** Asks if you want to deploy the enabled workers immediately.

The wizard uses `.install-wizard-state.json` to save progress, allowing you to resume if interrupted.

## Management CLI (`manage.ts`)

Use `bun run manage.ts <command>` for ongoing management.

**Commands:**

- `bun run manage.ts init`

  - Runs the interactive first-time setup wizard (see above).

- `bun run manage.ts workers setup`

  - Configures all _enabled_ workers based on `config.toml`.
  - Updates `wrangler.toml` files (name, account ID, vars, D1 bindings if applicable).
  - Prompts for missing secrets (checking env/local keys first) and uploads them.
  - Runs D1 migrations if the `d1-worker` is enabled and has a `migrations/` directory.

- `bun run manage.ts workers deploy`

  - Deploys all _enabled_ workers using `wrangler deploy`.
  - Captures the deployed URL and saves it back to `config.toml` under the worker's `deployed_url` key.

- `bun run manage.ts workers dev <workerName>`

  - Starts a local development server for the specified worker using `wrangler dev`.

- `bun run manage.ts workers status`

  - Displays a summary of all workers defined in `config.toml`, showing their enabled/disabled status, path, deployed URL (if known), and counts of vars/secrets.

- `bun run manage.ts workers test [workerName]`

  - Runs tests using `bun test` within the specified worker's directory (or all enabled workers if `workerName` is omitted). Assumes tests are in a `test/` subdirectory.
  - Supports `--coverage` and `--watch` flags passed to `bun test`.

- `bun run manage.ts workers update-internal-urls`

  - Updates `*_WORKER_URL` variables in all `wrangler.toml` files based on the `deployed_url` values stored in `config.toml`. Useful after deploying all workers.

- `bun run manage.ts keys generate <keyName> [-e local|prod]`

  - Generates a new secure random key and saves it to the specified environment's `.keys/*.env` file (`local` by default).

- `bun run manage.ts keys get <keyName> [-e local|prod]`

  - Retrieves and prints the value of a key from the specified environment's `.keys/*.env` file.

- `bun run manage.ts keys list [-e local]`

  - Lists all keys stored in `.keys/local_keys.env`. (The `-e prod` option is deprecated).

- `bun run manage.ts secrets update-cf <keyName> <workerName> [-e local]`
  - Updates a Cloudflare secret for a specific worker, reading the value from `.keys/local_keys.env`.
  - This is primarily useful for setting up secrets required by `wrangler dev` for local development.
  - **For production secrets, manage them directly via the Cloudflare dashboard or `wrangler secret put`.**

## Development

To run a worker locally during development:

1.  Ensure the worker is enabled in `config.toml`.
2.  Make sure any necessary secrets are available for local development. You can:
    *   Place them in `.keys/local_keys.env` and use `bun run manage.ts secrets update-cf <keyName> <workerName>` to upload them to Cloudflare (so `wrangler dev` can access them).
    *   Set them as environment variables.
    *   Manage them directly in Cloudflare if `wrangler dev` should pull them from there.
3.  Run `bun run manage.ts workers dev <workerName>`.

## Testing

To run tests for a specific worker or all enabled workers:

```bash
# Test a specific worker
bun run manage.ts workers test trade-worker

# Test all enabled workers
bun run manage.ts workers test

# Run tests with coverage
bun run manage.ts workers test --coverage
```

## Deployment

1.  Ensure workers are configured correctly (`bun run manage.ts workers setup`).
2.  Deploy all enabled workers:
    ```bash
    bun run manage.ts workers deploy
    ```
3.  (Optional) Update internal URL references after deployment:
    ```bash
    bun run manage.ts workers update-internal-urls
    # Re-deploy workers whose wrangler.toml was updated if necessary
    bun run manage.ts workers deploy
    ```
