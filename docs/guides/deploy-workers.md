---
title: "Deploy Workers"
description: "Deploy and update your Hoox trading infrastructure"
---

# Deploy Workers

## Deploy Everything

```bash
hoox deploy all
```

This deploys all enabled workers to Cloudflare in the correct dependency order (infrastructure workers first, gateway last).

## Deploy a Single Worker

```bash
hoox deploy worker trade-worker
```

## After Deployment

```bash
# Set Telegram webhook (if Telegram worker is enabled)
hoox deploy telegram-webhook

# Update dashboard service URLs
hoox deploy update-internal-urls

# Apply default KV settings
hoox deploy kv-config
```

## Updating Workers

```bash
git pull --recurse-submodules
bun install
hoox test              # lint → typecheck → test → build
hoox deploy all
```

## How Deployment Works

When you run `hoox deploy all`, the CLI:

1. Checks which workers are enabled in `wrangler.jsonc`
2. Deploys workers in dependency order (d1-worker first, hoox gateway last)
3. Optionally builds and deploys the Next.js dashboard via OpenNext
4. Each worker is uploaded to Cloudflare and becomes live at `https://{worker}.{prefix}.workers.dev`

> **Deep dive:** [DevOps Deployment Sequence](../devops/deployment/production.md)

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `502 Bad Gateway` | Service binding target not deployed yet | Run `hoox deploy all` to enforce dependency order |
| `401 Unauthorized` | Missing or wrong API key | `hoox secrets update-cf` |
| Worker not appearing | Worker disabled in `wrangler.jsonc` | `hoox config set workers.<name>.enabled true` |

## Next Steps

- [Monitoring Guide](monitor-trading.md) — Verify your deployment is healthy
