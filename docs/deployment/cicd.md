# 🔄 CI/CD

> Automating the deployment pipeline

## GitHub Actions

You can automate deployments using GitHub Actions. Create a `.github/workflows/deploy.yml` file in the root of your repository.

### Example Workflow

```yaml
name: Deploy Cloudflare® Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Deploy Workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          # Use wrangler directly or your management script
          hoox workers deploy
```

## Environment Management

Use GitHub Secrets to securely store:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Do not store worker-specific secrets in GitHub if they are already in Cloudflare®'s Secret Store. The workers will access them securely at runtime.

## Next Steps

- [Monitoring](monitoring.md)

---

_Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions._
