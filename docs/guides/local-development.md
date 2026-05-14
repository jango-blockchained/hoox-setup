---
title: "Local Development"
description: "Run and test Hoox workers locally"
---

# Local Development

## Start All Workers

```bash
hoox dev start
```

This launches all enabled workers locally. You'll be prompted to choose a runtime:

- **Native** — Uses `wrangler dev` for each worker (fast, requires wrangler)
- **Docker** — Uses Docker Compose with all dependencies (isolated, requires Docker)

Your preference is saved for future sessions. Override with:

```bash
hoox dev start --runtime native
hoox dev start --runtime docker
```

## Docker Compose Profiles

```bash
# Workers only
docker compose --profile workers up

# Workers + dashboard
docker compose --profile full up
```

## Single Worker

```bash
hoox dev worker hoox
hoox dev worker trade-worker
```

## Dashboard

```bash
hoox dev dashboard
```

Opens at `http://localhost:3000`.

## Terminal UI

```bash
./hoox-tui
```

Interactive process manager for all 9 workers with hot-reload.

## CI Pipeline

```bash
hoox test
```

Runs in order: lint → typecheck → test → build.

## Next Steps

- [Deploy Workers](deploy-workers.md) — Take your local setup to production
