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

## Terminal UI (TUI)

The Hoox TUI is a full-screen terminal operations center for monitoring and managing your trading infrastructure. It provides 9 keyboard-driven views for real-time visibility into workers, trades, logs, and configuration.

```bash
# Launch via shell script (repo root)
./hoox-tui

# Launch via CLI
hoox tui
hoox tui --fps 60     # Override frame rate
hoox tui --no-mouse   # Disable mouse support

# Direct development mode
cd packages/tui && bun run dev

# Run built bundle
cd packages/tui && bun run start
```

**Key features:**

- **9 views**: Dashboard, Workers Overview, Worker Detail, Trade Monitor, Logs Viewer, Service Manager, Config Editor, Setup Wizard, Settings
- **Keyboard navigation**: `Ctrl+1-9` to switch views, `Ctrl+P` command palette, `Ctrl+B` toggle sidebar
- **Real-time data**: REST polling + SSE streaming for live trades and logs
- **Built-in editor**: Syntax-highlighted TOML/JSON config editing
- **Connection resilience**: Auto-reconnection with exponential backoff

> **See the [TUI User Guide](tui.md)** for complete documentation, view descriptions, and troubleshooting.

## CI Pipeline

```bash
hoox test
```

Runs in order: lint → typecheck → test → build.

## Next Steps

- [Deploy Workers](deploy-workers.md) — Take your local setup to production
