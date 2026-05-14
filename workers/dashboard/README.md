# @hoox/dashboard

[![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Platform](https://img.shields.io/badge/Platform-Cloudflare%C2%AE%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)

Next.js 16 web dashboard for portfolio monitoring and risk management.

## For CLI Users

Use this dashboard when you run `hoox` commands:

- `hoox dev dashboard` — start the Next.js dev server
- `hoox deploy dashboard` — build and deploy to Cloudflare Workers

→ [Deploy Guide](../../docs/guides/deploy-workers.md) · [CLI Reference](../../docs/reference/cli-commands.md)

## For Operators

This worker provides the visual command center for the Hoox ecosystem. Built with Next.js 16 and deployed via OpenNext on Cloudflare Workers, it reads portfolio data from the D1 worker, writes configuration changes to CONFIG_KV, and dispatches emergency actions through the hoox gateway. Protected by Cloudflare Access (Zero Trust).

→ [Operator Docs](../../docs/devops/workers/dashboard.md)

## Development

```bash
bun test workers/dashboard
```
