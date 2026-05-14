---
title: "Installation"
description: "Install the Hoox CLI and bootstrap your trading project"
---

# Installation

## Prerequisites

- **Bun** ≥1.2: `curl -fsSL https://bun.sh | bash`
- **Cloudflare account**: [Sign up free](https://dash.cloudflare.com/)

## Option A: Install via Package Manager (Recommended)

```bash
bun add -g @jango-blockchained/hoox-cli
```

## Option B: Build from Source

```bash
git clone --recursive https://github.com/jango-blockchained/hoox-setup.git
cd hoox-setup
bun install
# CLI is available at packages/cli/bin/hoox.js
```

## Bootstrap Your Project

```bash
hoox clone my-trading-app
cd my-trading-app
```

This clones all worker repositories as git submodules and sets up the workspace.

## Initialize Configuration

```bash
hoox init
```

The interactive wizard will:
1. Check dependencies (bun, wrangler, git)
2. Prompt for Cloudflare credentials
3. Configure which workers to enable
4. Create required secrets

## Verify Installation

```bash
hoox check prerequisites
hoox --version
hoox --help
```

## Next Steps

- [Quick Start](quick-start.md) — Send your first trade in 5 minutes
- [Configuration](configuration.md) — Environment variables and settings
