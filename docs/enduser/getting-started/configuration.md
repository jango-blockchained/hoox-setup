---
title: "Configuration"
description: "Environment variables, secrets, and settings reference"
---

# Configuration

## Environment Variables

Hoox uses a `.env.local` file at the project root for local configuration. Copy the template to get started:

```bash
cp .env.example .env.local
```

### Required Variables

| Variable                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with Worker/Account permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                           |
| `SUBDOMAIN_PREFIX`      | Prefix for worker subdomains (e.g., `mytrading`)     |

### Optional Variables

See `.env.example` for the full list of optional variables: Telegram bot tokens, AI provider keys, exchange API keys, dashboard credentials.

## Managing Configuration via CLI

```bash
# Interactive env setup
hoox config env init

# View current config (secrets redacted)
hoox config env show

# Validate required variables
hoox config env validate

# Generate per-worker dev vaults
hoox config env generate-dev-vars
```

## Worker Configuration (`wrangler.jsonc`)

The central `wrangler.jsonc` file controls which workers are enabled and their settings:

```bash
# Show current config
hoox config show

# Update configuration
hoox config set workers.hoox.enabled true
```

## KV Configuration (Runtime Settings)

Some settings can be changed without redeploying:

```bash
# Check kill switch status
hoox config kv get trade:kill_switch

# Set maximum daily drawdown
hoox config kv set trade:max_daily_drawdown_percent 10

# Apply all default settings
hoox config kv apply-manifest
```

## Next Steps

- [Deploy Workers](../guides/deploy-workers.md) — Deploy your configured system
