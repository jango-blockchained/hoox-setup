---
title: "Secrets & Security"
description: "Manage API keys, secrets, and access control"
---

# Secrets & Security

## Managing Secrets

Secrets (exchange API keys, Telegram tokens, internal auth keys) are stored at Cloudflare — never in your repository.

```bash
# Set a secret
hoox secrets update-cf BINANCE_API_KEY trade-worker

# Check which secrets are set
hoox secrets check

# Sync all secrets from configuration
hoox secrets update-cf
```

## Zero Trust Architecture

Internal workers (trade-worker, d1-worker) have no public endpoints. They can only be reached through Cloudflare Service Bindings — private, encrypted connections between your workers.

The only public entry points are:
- **hoox gateway** — receives webhooks
- **dashboard** — UI interface
- **Telegram bot** — command processing

## Best Practices

1. **Never commit secrets** — `.env.local` and `.dev.vars` are gitignored
2. **Use `hoox secrets update-cf`** — never pass secrets as CLI arguments
3. **Rotate exchange keys every 90 days**
4. **Use least privilege** — create exchange API keys with trading-only permissions
5. **Kill switch** — `hoox monitor kill-switch on` halts all trading instantly

## Next Steps

- [Monitor Trading](monitor-trading.md) — Watch for suspicious activity
