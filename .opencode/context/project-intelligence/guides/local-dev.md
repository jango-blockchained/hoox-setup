<!-- Context: project-intelligence/guides | Priority: high | Version: 2.1 | Updated: 2026-05-14 -->

# Local Development

**Concept**: Run workers locally with `hoox dev start` (Native vs Docker runtime selection).

## Quick Start

```bash
bun install
cp workers/hoox/.dev.vars.example workers/hoox/.dev.vars
hoox dev start              # interactive: choose Native or Docker
hoox dev start --runtime native   # force wrangler dev
hoox dev start --runtime docker   # force docker compose
```

## Dev Runtime Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **Native** | `wrangler dev` per worker | Direct debugging, fast iteration |
| **Docker** | `docker compose up` | Full stack in containers, consistent env |

## Local Ports

| Service           | Port |
| ----------------- | ---- |
| hoox              | 8787 |
| trade-worker      | 8788 |
| d1-worker         | 8789 |
| telegram-worker   | 8790 |
| web3-wallet       | 8792 |
| agent-worker      | 8795 |
| email-worker      | 8796 |
| analytics-worker  | 8797 |
| report-worker     | 8798 |
| dashboard         | 3000 |

## Docker Compose Profiles

```bash
docker compose --profile workers up         # workers only
docker compose --profile full up          # workers + dashboard
docker compose down
```

| Profile | Services |
|---------|----------|
| `workers` | hoox, trade-worker, telegram-worker, d1-worker, web3-wallet-worker, agent-worker, email-worker, analytics-worker, report-worker |
| `dashboard` | dashboard |
| `full` | all services |

## Wrangler Version Check

`hoox dev start` checks wrangler version on every run. Advisory warning if outdated, offers `bunx wrangler update`.

## Commands

```bash
hoox dev start [--runtime native|docker]  # all workers
hoox dev worker <name> [--runtime]         # single worker
hoox dev dashboard                          # Next.js dashboard
```

## 📂 Codebase References

**Local dev doc**: `docs/devops/development/local-dev.md`
**CLI**: `packages/cli/src/commands/dev/dev-command.ts`
**Prerequisites**: `packages/cli/src/services/prerequisites/`
**Docker**: `packages/cli/src/services/docker/`
**Docker Compose**: `docker-compose.yml` (profiles: workers, dashboard, full)
**Central config**: `wrangler.jsonc` (dev.runtime preference)
