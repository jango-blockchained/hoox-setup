# 💻 Local Development

> How to run and test Hoox workers locally

## Prerequisites

- Bun ≥1.2
- Wrangler CLI (`bunx wrangler` or `npm install -g wrangler`) — checked on every `hoox dev start`
- Cloned repository with initialized configuration

## Dev Runtime Selection

`hoox dev start` supports two runtime modes:

| Runtime | Command | Description |
|---------|---------|-------------|
| **Native** | `wrangler dev` per worker | Runs each worker directly via wrangler on local ports |
| **Docker** | `docker compose up` | Runs all workers via Docker Compose |

### Choosing a Runtime

When you run `hoox dev start`:

1. **Wrangler version check** — shows advisory warning if wrangler is outdated, offers `bunx wrangler update`
2. **Docker detection** — checks if Docker + Docker Compose are installed
3. **Prompt** — if Docker is available, asks which runtime to use (Native or Docker)
4. **Saved preference** — choice persists to `wrangler.jsonc`, subsequent runs don't re-prompt

### Overriding the Runtime

```bash
hoox dev start --runtime native   # force wrangler dev
hoox dev start --runtime docker   # force docker compose
```

## Running the Dev Server

### Start All Workers

```bash
hoox dev start
```

This loads workers from `wrangler.jsonc` and starts each enabled worker.

### Docker Compose (Alternative)

You can also run Docker Compose directly with profiles:

```bash
# Workers only
docker compose --profile workers up

# Workers + dashboard
docker compose --profile workers --profile dashboard up

# Everything (full stack)
docker compose --profile full up

# Stop
docker compose down
```

| Profile | Services |
|---------|----------|
| `workers` | hoox, trade-worker, telegram-worker, d1-worker, web3-wallet-worker, agent-worker, email-worker |
| `dashboard` | dashboard |
| `full` | all services |

### Run a Single Worker

```bash
hoox dev worker <name> [--port <port>] [--runtime native|docker]
```

Example:

```bash
hoox dev worker hoox --port 8787
hoox dev worker trade-worker --port 8788
```

### Dashboard

```bash
hoox dev dashboard
```

Starts the Next.js dashboard at `http://localhost:3000`.

## Local Ports

| Service         | Port |
| --------------- | ---- |
| hoox            | 8787 |
| trade-worker    | 8788 |
| d1-worker       | 8789 |
| telegram-worker | 8790 |
| agent-worker    | 8795 |
| email-worker    | 8796 |
| web3-wallet     | 8792 |
| dashboard       | 3000 |

## Environment Setup

Each worker relies on environment variables for local development stored in `.dev.vars`:

```bash
cp workers/hoox/.dev.vars.example workers/hoox/.dev.vars
# Edit .dev.vars with your API keys
```

## Wrangler Version Check

On every `hoox dev start`, the CLI checks if wrangler is up to date:

```
⚠️  wrangler is outdated (3.87.0 < 3.88.0)
   Run `bunx wrangler update` to update, or press Enter to continue anyway.
```

This is advisory — you can continue even with an outdated version.

## Next Steps

- [Testing](testing.md)
- [Debugging](debugging.md)

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
