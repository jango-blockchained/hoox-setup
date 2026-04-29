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
5. **Save Configuration**: Saves all your settings to `workers.jsonc`.
6. **Configure Secrets**: Guides you through setting up secrets for your workers.
7. **Initial Deployment**: Optionally deploys all enabled workers.

## Running the Installation Wizard

To start the installation process, run:

```bash
hoox init
# or with the full command
hoox init
```

The installation wizard will:

1. Detect the `workers.jsonc` configuration format
2. Guide you through the setup process step by step
3. Save your progress in `.install-wizard-state.json`, so you can continue from where you left off if needed
4. Save the final configuration to `workers.jsonc`

### Configuration File

The system uses `workers.jsonc` as the central configuration file:

- If `workers.jsonc` already exists, the wizard will use and update that file
- If it doesn't exist, the wizard will create one from `workers.jsonc.example`
- The format choice is stored in the wizard state file for consistency during the setup process

## Validating Your Setup

After installation, or any time you want to check if your configuration is valid, you can run:

```bash
hoox check-setup
# or with the full command
hoox check-setup
```

This command verifies:
- All required configuration files exist
- Configuration files are properly formatted
- Configuration structure matches between actual and example files
- All enabled workers have the necessary directory structure and configuration
- Secret Store bindings are properly configured for workers that need them

The validation tool provides a detailed report with color-coded results to help you identify and fix any issues.

## Configuration Files

> **Note for Agents/Developers:** The system enforces strict typing for all configuration files via the `Config` and `WorkerConfig` interfaces in `packages/hoox-cli/src/types.ts`. Avoid using `as any` when parsing or updating configurations.

### workers.jsonc / workers.jsonc.example

The project uses JSONC (JSON with Comments) as its configuration format:

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

3. Add your Secret Store ID to `workers.jsonc` under the `cloudflare_secret_store_id` field.

### Adding Secrets

For each worker that requires secrets:

1. Define the secret names in the worker's section in `workers.jsonc` under the `secrets` array.
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

- **Secret Store Bindings**: Automatically configured based on the `secrets` array in `workers.jsonc`
- **D1 Bindings**: Set up for workers that need database access
- **Other Bindings**: Must be manually configured in each worker's wrangler configuration file

### Environment Variables

Environment variables can be set in `workers.jsonc` under each worker's `vars` object:

```jsonc
{
  "workers": {
    "d1-worker": {
      "vars": { "database_name": "my-database", "api_version": "v1" }
    }
  }
}
```

These are added to the worker's configuration file during setup.

## Managing Workers

After installation, you can use the following commands to manage your workers:

- **Setup (without deploying)**:
  ```bash
  hoox workers setup
  # or with the full command
  hoox workers setup
  ```

- **Deploy**:
  ```bash
  hoox workers deploy
  # or with the full command
  hoox workers deploy
  ```

- **Run Dev Server**:
  ```bash
  hoox workers dev <worker-name>
  # or with the full command
  hoox workers dev <worker-name>
  ```

- **Check Status**:
  ```bash
  hoox workers status
  # or with the full command
  hoox workers status
  ```

- **Run Tests**:
  ```bash
  bun run tests
  # or with the full command
  hoox workers test [worker-name]
  ```

## Clone Worker Repositories

This project supports two ways of initializing your worker directories:

1. **Clone the main repository with all worker repositories** (using Git submodules)
2. **Clone only the main repository and then selectively clone worker repositories**

If you've cloned only the main repository without workers, you can use the worker clone command:

```bash
hoox workers clone
# or with the full command
hoox workers clone
```

This command will:
1. Check if the workers directory exists and create it if needed
2. Provide a list of available worker repositories to clone
3. Allow you to select specific workers or clone all of them
4. Clone the selected workers as Git submodules by default

Options:
- Use `--direct` to clone repositories directly instead of as submodules:
  ```bash
  hoox workers clone --direct
  ```

**Note:** When you run `hoox init`, the wizard will automatically detect if you have no worker directories and prompt you to clone them.

## Troubleshooting

- **Wizard Interrupted**: The wizard saves progress in `.install-wizard-state.json`. Simply run `hoox init` again to continue.
- **Secret Binding Issues**: Verify secrets exist in your Secret Store with `wrangler secrets-store secret list --store-id <your-store-id>`
- **Check Worker Status**: Use `hoox workers status` to see if any workers are misconfigured
- **Deployment Failures**: Check the Cloudflare® dashboard for errors or run `wrangler tail <worker-name>` to view logs 

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
