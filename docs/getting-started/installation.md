# 🚀 Installation Guide

> How to set up Hoox on your local machine

## Prerequisites

| Tool                | Version | Installation                            |
| ------------------- | ------- | --------------------------------------- | ----- |
| Bun                 | ≥1.2    | `curl -fsSL https://bun.sh              | bash` |
| Git                 | ≥2.40   | `apt install git`                       |
| Cloudflare® Account | -       | [Sign up](https://dash.cloudflare.com/) |

## Step 1: Bootstrap Repository

### Option A: Install via CLI (Recommended)

We recommend installing the `@jango-blockchained/hoox-cli` globally to bootstrap your environment seamlessly without dealing with git submodules manually:

```bash
# 1. Install the CLI globally
# Recommended
bun add -g @jango-blockchained/hoox-cli

# Alternatives
npm install -g @jango-blockchained/hoox-cli

# 2. Download the repo and properly initialize all submodules
hoox clone my-hoox-app
cd my-hoox-app
```

### Option B: Install from Source

If you prefer a traditional git workflow, you can clone the repository directly. Be sure to use the `--recursive` flag to fetch all submodules:

```bash
# 1. Clone the repository with all submodules
git clone --recursive https://github.com/jango-blockchained/hoox-setup.git my-hoox-app
cd my-hoox-app
```

## Step 2: Install Dependencies & Configs

```bash
bun install
hoox config setup
```

## Step 3: Configure Cloudflare®

### Option A: Interactive Wizard

```bash
hoox init
```

This wizard will:

1. Check dependencies (bun, wrangler)
2. Prompt for Cloudflare® credentials
3. Enable workers in workers.jsonc
4. Create required secrets
5. Deploy workers

### Option B: Manual Configuration

Create `workers.jsonc`:

````jsonc
{
  "global": {
    "cloudflare_api_token": "cfut_...",
    "cloudflare_account_id": "your-account-id",
    "cloudflare_secret_store_id": "your-secret-store-id",
    "subdomain_prefix": "your-prefix"
  },
  "workers": {
    "hoox": {
      "enabled": true,
      "path": "workers/hoox",
      "secrets": ["WEBHOOK_API_KEY_BINDING", "INTERNAL_KEY_BINDING"]
    }
  }
}

## Step 4: Create Secrets

```bash
# Generate a secure API key
hoox keys generate WEBHOOK_API_KEY_BINDING

# Upload to Cloudflare®
hoox secrets update-cf WEBHOOK_API_KEY_BINDING hoox
````

## Step 5: Deploy Workers

```bash
# Deploy all enabled workers
hoox workers deploy

# Or deploy specific worker
hoox workers deploy hoox
```

## Verification

```bash
# Run tests
bun test

# Check worker status
hoox workers status
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
hoox workers setup
```

## Next Steps

- [Quick Start Guide](quick-start.md)
- [Configuration](configuration.md)
- [Architecture Overview](../architecture/overview.md)

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._
