# 💻 Local Development

> How to run and test Hoox workers locally

## Prerequisites

- Bun ≥1.2
- Wrangler CLI (`bunx wrangler` or `npm install -g wrangler`)
- Cloned repository with initialized configuration

## Environment Setup

Each worker relies on environment variables for local development. These are stored in `.dev.vars` files inside each worker directory.

1. Copy the example vars file:
   ```bash
   cp workers/hoox/.dev.vars.example workers/hoox/.dev.vars
   ```
2. Fill in the required variables (e.g., `WEBHOOK_API_KEY_BINDING`).

## Running the Dev Server

You can run individual workers or multiple workers simultaneously for local testing.

### Run a Single Worker

Use the management script to start a worker in dev mode:

```bash
hoox workers dev hoox
```

This uses Wrangler under the hood with bunx:

```bash
# Direct command
bunx wrangler dev --port 8787
```

### Local Service Bindings

When running locally, Cloudflare® Workers can communicate with each other using local service bindings. The ports for local development are mapped as follows:

| Service         | Local Port |
| --------------- | ---------- |
| hoox            | 8787       |
| trade-worker    | 8788       |
| d1-worker       | 8789       |
| telegram-worker | 8790       |

| web3-wallet | 8792 |
| dashboard (Pages) | 8783 |

### Cloudflare Pages (dashboard)

The dashboard uses Cloudflare Pages with Next.js. To run locally:

```
hoox workers dev dashboard
```

Or directly:

```
cd pages/dashboard && bun run dev
```

```

This runs the Next.js dev server, which can be accessed at `http://localhost:3000`.

To test local bindings, you must have all dependent workers running in separate terminal windows.

## Next Steps

- [Testing](testing.md)
- [Debugging](debugging.md)

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
```
