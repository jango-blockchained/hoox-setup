# Cloudflare® Workers Installation Flow

This document outlines the installation and setup process for the Cloudflare® Workers in this project.

## Overview

This project uses a series of scripts to manage and deploy multiple Cloudflare® Workers. The installation process is handled by a wizard that guides you through the necessary steps to configure and deploy all the workers.

## Prerequisites

Before starting the installation, ensure you have:

- [Bun](https://bun.sh/) installed
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) installed (`bun install -g wrangler`)
- A Cloudflare® account with:
  - Account ID
  - API Token with appropriate permissions
  - Secret Store set up (See the [Secrets Management](#secrets-management) section)

## Installation Steps

The installation wizard guides you through 7 steps:

1. **Check Dependencies**: Verifies that bun and wrangler are installed.
2. **Configure Global Settings**: Sets up global configuration parameters:
   - Cloudflare® API Token
   - Cloudflare® Account ID
   - Cloudflare® Secret Store ID
   - Subdomain prefix for workers (e.g., "my-app" → worker-name.my-app.workers.dev)
3. **Select Workers**: Choose which workers to enable from the available workers in the `workers/` directory.
4. **Setup D1 Database**: If any worker requires a D1 database, it will be set up during this step.
5. **Save Configuration**: Saves all your settings to `config.toml`.
6. **Configure Secrets**: Guides you through setting up secrets for your workers.
7. **Initial Deployment**: Optionally deploys all enabled workers.

## Running the Installation Wizard

To start the installation process, run:

```bash
hoox init
# or with the full command
hoox manage.ts init
```

The installation wizard will:

1. Auto-detect your configuration format (TOML or JSONC)
2. Guide you through the setup process step by step
3. Save your progress in `.install-wizard-state.json`, so you can continue from where you left off if needed
4. Save the final configuration to either `config.toml` or `config.jsonc` depending on which format was detected

### Format Selection

When running the wizard for the first time:

- If `config.jsonc` already exists, the wizard will use and update that file
- If `config.toml` already exists, the wizard will use and update that file 
- If neither file exists, the wizard will check for example files and choose the format accordingly
- The format choice is stored in the wizard state file for consistency during the setup process

You can switch formats manually after setup by creating a new file in the desired format and deleting the old one.

## Validating Your Setup

After installation, or any time you want to check if your configuration is valid, you can run:

```bash
hoox check-setup
# or with the full command
hoox manage.ts check-setup
```

This command verifies:
- All required configuration files exist
- Configuration files are properly formatted
- Configuration structure matches between actual and example files
- All enabled workers have the necessary directory structure and configuration
- Secret Store bindings are properly configured for workers that need them

The validation tool provides a detailed report with color-coded results to help you identify and fix any issues.

## Configuration Files

> **Note for Agents/Developers:** The system enforces strict typing for all configuration files via the `WranglerConfig` and `Config` interfaces in `scripts/types.ts`. Avoid using `as any` when parsing or updating configurations. Always cast safely to the appropriate interface to maintain type safety across management scripts.

The project supports two configuration file formats. The installation scripts automatically detect which format you're using:

### config.toml / config.toml.example

The TOML format is the original configuration format. It's a minimal configuration language that is easy for humans to read and write.

Example:
```toml
[global]
cloudflare_api_token = "your_api_token"
cloudflare_account_id = "your_account_id"
cloudflare_secret_store_id = "your_secret_store_id"
subdomain_prefix = "your-prefix"

[workers.d1-worker]
enabled = true
path = "workers/d1-worker"
vars = { database_name = "my-database" }
secrets = []

[workers.telegram-worker]
enabled = true
path = "workers/telegram-worker"
vars = {}
secrets = ["TELEGRAM_BOT_TOKEN"]
```

### config.jsonc / config.jsonc.example

The JSONC format (JSON with Comments) is an alternative configuration format. It's based on JSON but allows for comments, which can be helpful for documentation.

Example:
```jsonc
{
  "global": {
    /* Cloudflare® API Token - get this from your Cloudflare® dashboard */
    "cloudflare_api_token": "your_api_token",
    "cloudflare_account_id": "your_account_id",
    "cloudflare_secret_store_id": "your_secret_store_id",
    "subdomain_prefix": "your-prefix"
  },
  "workers": {
    "d1-worker": {
      "enabled": true,
      "path": "workers/d1-worker",
      "vars": { 
        "database_name": "my-database" 
      },
      "secrets": []
    }
  }
}
```

### Format Selection

The system automatically detects which format you're using:

1. If `config.jsonc` exists, it will be used.
2. Otherwise, `config.toml` will be used.

When you run the installation wizard, it will create a configuration file in the format you're using. If neither file exists, it will default to TOML.

You can switch between formats by creating a new file in the desired format. For example, if you're currently using `config.toml` and want to switch to JSONC, create a `config.jsonc` file with the equivalent configuration.

### .install-wizard-state.json

This is a temporary file created during the installation process to track progress. It is deleted upon successful completion of the wizard.

## Secrets Management

This project uses Cloudflare®'s Secret Store for managing sensitive information. The Secret Store is a centralized location for storing secrets that can be safely accessed by your workers.

### Setting Up Secret Store

1. Create a Secret Store using Wrangler:
   ```bash
   npx wrangler secrets-store store create <your-store-name>
   ```

2. List your stores to find the Secret Store ID:
   ```bash
   npx wrangler secrets-store store list
   ```

3. Add your Secret Store ID to `config.toml` under the `cloudflare_secret_store_id` field.

### Adding Secrets

For each worker that requires secrets:

1. Define the secret names in the worker's section in `config.toml` under the `secrets` array.
2. Add the secret to your Secret Store:
   ```bash
   npx wrangler secrets-store secret put <secret-name> --store-id <store-id>
   ```

### Secret Bindings

The setup process automatically configures Secret Store bindings in each worker's configuration file.

For wrangler.toml files, bindings follow this convention:

```toml
[secrets_store_secrets]
[[secrets_store_secrets]]
binding = "SECRET_NAME_BINDING"
store_id = "your_secret_store_id"
secret_name = "your_secret_name"
```

For wrangler.jsonc files, bindings follow this convention:

```json
{
  "secrets_store": {
    "bindings": [
      {
        "binding": "SECRET_NAME_BINDING",
        "store_id": "your_secret_store_id",
        "secret_name": "your_secret_name"
      }
    ]
  }
}
```

## Worker Configuration

Each worker is configured with:

### Configuration Files

The installation script supports both configuration formats:

- **wrangler.jsonc**: The newer JSON-based configuration format with comments (preferred)
- **wrangler.toml**: The older TOML-based configuration format

The script will automatically detect which format is used for each worker and update it accordingly. If both files exist, wrangler.jsonc will be prioritized.

### Bindings

- **Secret Store Bindings**: Automatically configured based on the `secrets` array in `config.toml`
- **D1 Bindings**: Set up for workers that need database access
- **Other Bindings**: Must be manually configured in each worker's wrangler configuration file

### Environment Variables

Environment variables can be set in `config.toml` under each worker's `vars` object:

```toml
[workers.d1-worker]
vars = { database_name = "my-database", api_version = "v1" }
```

These are added to the worker's configuration file during setup.

## Managing Workers

After installation, you can use the following commands to manage your workers:

- **Setup (without deploying)**:
  ```bash
  hoox workers setup
  # or with the full command
  hoox manage.ts workers setup
  ```

- **Deploy**:
  ```bash
  hoox workers deploy
  # or with the full command
  hoox manage.ts workers deploy
  ```

- **Run Dev Server**:
  ```bash
  hoox workers dev <worker-name>
  # or with the full command
  hoox manage.ts workers dev <worker-name>
  ```

- **Check Status**:
  ```bash
  hoox workers status
  # or with the full command
  hoox manage.ts workers status
  ```

- **Run Tests**:
  ```bash
  hoox tests
  # or with the full command
  hoox manage.ts workers test [worker-name]
  ```

## Clone Worker Repositories

This project supports two ways of initializing your worker directories:

1. **Clone the main repository with all worker repositories** (using Git submodules)
2. **Clone only the main repository and then selectively clone worker repositories**

If you've cloned only the main repository without workers, you can use the worker clone command:

```bash
hoox workers clone
# or with the full command
hoox manage.ts workers clone
```

This command will:
1. Check if the workers directory exists and create it if needed
2. Provide a list of available worker repositories to clone
3. Allow you to select specific workers or clone all of them
4. Clone the selected workers as Git submodules by default

Options:
- Use `--direct` to clone repositories directly instead of as submodules:
  ```bash
  hoox manage.ts workers clone --direct
  ```

**Note:** When you run `hoox init`, the wizard will automatically detect if you have no worker directories and prompt you to clone them.

## Troubleshooting

- **Wizard Interrupted**: The wizard saves progress in `.install-wizard-state.json`. Simply run `hoox manage.ts init` again to continue.
- **Secret Binding Issues**: Verify secrets exist in your Secret Store with `wrangler secrets-store secret list --store-id <your-store-id>`
- **Check Worker Status**: Use `hoox manage.ts workers status` to see if any workers are misconfigured
- **Deployment Failures**: Check the Cloudflare® dashboard for errors or run `wrangler tail <worker-name>` to view logs 

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
