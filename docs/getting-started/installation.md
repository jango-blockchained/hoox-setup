# 🚀 Installation Guide

> How to set up Hoox on your local machine

## Prerequisites

| Tool               | Version | Installation                            |
| ------------------ | ------- | --------------------------------------- | ----- |
| Bun                | ≥1.2    | `curl -fsSL https://bun.sh              | bash` |
| Git                | ≥2.40   | `apt install git`                       |
| Cloudflare® Account | -       | [Sign up](https://dash.cloudflare.com/) |

## Step 1: Clone Repository

```bash
# Clone with submodules (recommended)
git clone --recurse-submodules https://github.com/jango-blockchained/hoox-setup.git
cd hoox-setup

# Or if already cloned without submodules:
git submodule update --init --recursive
```

## Step 2: Install Dependencies

```bash
bun install
```

## Step 3: Configure Cloudflare®

### Option A: Interactive Wizard

```bash
bun run scripts/manage.ts init
```

This wizard will:

1. Check dependencies (bun, wrangler)
2. Prompt for Cloudflare® credentials
3. Enable workers in config.toml
4. Create required secrets
5. Deploy workers

### Option B: Manual Configuration

Create `config.toml`:

```toml
[global]
cloudflare_api_token = "cfut_..."
cloudflare_account_id = "your-account-id"
subdomain_prefix = "your-prefix"

[workers.hoox]
enabled = true
path = "workers/hoox"
secrets = ["WEBHOOK_API_KEY"]
```

## Step 4: Create Secrets

```bash
# Generate a secure API key
bun run scripts/manage.ts keys generate WEBHOOK_API_KEY

# Upload to Cloudflare®
bun run scripts/manage.ts secrets update-cf WEBHOOK_API_KEY hoox
```

## Step 5: Deploy Workers

```bash
# Deploy all enabled workers
bun run scripts/manage.ts workers deploy

# Or deploy specific worker
bun run scripts/manage.ts workers deploy hoox
```

## Verification

```bash
# Run tests
bun test

# Check worker status
bun run scripts/manage.ts workers status
```

## 🆘 Troubleshooting

### Submodules Not Cloned

```bash
git submodule update --init --recursive
```

### Wrangler Not Authenticated

```bash
wrangler login
```

### Missing Secrets

```bash
bun run scripts/manage.ts workers setup
```

## Next Steps

- [Quick Start Guide](quick-start.md)
- [Configuration](configuration.md)
- [Architecture Overview](../architecture/overview.md)


---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
