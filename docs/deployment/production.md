# 🚀 Production Deployment

> Taking your Hoox setup live

## Prerequisites

Before deploying to production, ensure you have:
1. Valid Cloudflare® Account & API Token.
2. Production secrets generated and uploaded to Cloudflare® Secret Store.
3. A fully configured `workers.jsonc`.

## Deployment Commands

The management script simplifies deployment:

```bash
# Deploy all enabled workers
hoox workers deploy

# Deploy a specific worker
hoox workers deploy trade-worker
```

## Secret Management

Production secrets should NEVER be committed to version control. They are managed via Cloudflare® Secret Store.

```bash
# Upload a secret to Cloudflare®
hoox secrets update-cf <SECRET_NAME> <worker-name>
```

## Custom Domains

By default, workers are deployed to `<worker-name>.<your-subdomain>.workers.dev`.
You can map these to custom domains via the Cloudflare® Dashboard under **Workers & Pages > custom domains**.

## Next Steps

- [CI/CD](cicd.md)
- [Monitoring](monitoring.md)

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
