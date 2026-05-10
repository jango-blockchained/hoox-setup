# Design: Dev Runtime Selection + Wrangler Version Check

**Date:** 2026-05-10
**Status:** Approved

## Overview

Enhance `hoox dev start` to support runtime selection (Native vs Docker) with advisory wrangler version checking.

## Goals

1. Check wrangler version on every `hoox dev start` — advisory warning if outdated, offer update
2. Detect Docker + Docker Compose availability before suggesting Docker mode
3. If Docker available and `docker-compose.yml` exists at root: prompt user to choose runtime
4. CLI flag `--runtime native|docker` bypasses interactive prompt
5. Persist runtime preference to `wrangler.jsonc` (`dev.runtime`) so subsequent runs don't re-prompt
6. Add compose profiles so users can toggle layers (workers, dashboard, db)

## Architecture

### New Services

| Service | Path | Responsibility |
|---------|------|----------------|
| `PrerequisitesService` | `services/prerequisites/index.ts` | Check wrangler version, Docker/Docker Compose availability |
| `DockerService` | `services/docker/index.ts` | Run `docker compose` commands, parse availability |

### Enhanced Commands

| File | Changes |
|------|---------|
| `commands/dev/dev-command.ts` | Add runtime selection flow, integrate services |
| `ui/menu.ts` | Update "Start dev server" to pass runtime flag |

### Config Schema

`wrangler.jsonc` gains a `dev` section:

```jsonc
{
  "dev": {
    "runtime": "native" // or "docker" — persists user preference
  }
}
```

## UX Flow

```
hoox dev start [--runtime native|docker]
    │
    ├─► Check wrangler version
    │       ├─► Current version < latest → show warning
    │       │       └─► Prompt: "Update now? [Y/n]"
    │       │           ├─► Y → run `bunx wrangler update`
    │       │           └─► n → continue (advisory, not blocking)
    │       └─► If can't check → log warning, continue
    │
    ├─► Check Docker availability
    │       └─► Run `docker --version` && `docker compose version`
    │           ├─► Both available → Docker viable
    │           └─► Missing → skip Docker entirely
    │
    ├─► Compose file check
    │       └─► `docker-compose.yml` exists at root
    │           ├─► Yes + Docker viable + no --runtime flag:
    │           │       └─► Prompt: "Native (wrangler) or Docker?"
    │           │           └─► Save choice to wrangler.jsonc.dev.runtime
    │           └─► No → use Native
    │
    └─► Launch
        ├─► Native → CloudflareService.dev() for each worker + spawn dashboard
        └─► Docker → DockerService.composeUp(profiles)
```

## Prerequisite Checks

### Wrangler Version Check

1. Run `wrangler --version` via `PrerequisitesService`
2. Parse version string (e.g., `wrangler 3.87.0`)
3. Call `https://registry.npmjs.org/wrangler/latest` (or `bunx npm-check-updates wrangler`) to get latest
4. Compare semver — if current < latest, show warning:

```
⚠️  wrangler is outdated (3.87.0 < 3.88.0)
   Run `bunx wrangler update` to update, or press Enter to continue anyway.
```

### Docker Availability

1. `docker --version` → must succeed
2. `docker compose version` OR `docker-compose --version` → must succeed (v2 uses `docker compose`, v1 uses `docker-compose`)
3. Both required; missing either means Docker is not viable

## Docker Mode

### Existing Compose File

`docker-compose.yml` at root already exists with all 8 services (workers + dashboard). We'll add profiles without removing existing configuration.

### Profile Structure

```yaml
services:
  hoox:
    # existing config...
    profiles:
      - workers
      - full

  trade-worker:
    profiles:
      - workers
      - full
    # ... etc

  dashboard:
    profiles:
      - dashboard
      - full

  # agent-worker, email-worker, etc. → workers profile
```

Profiles:
- `workers` — all worker services (hoox, trade-worker, telegram-worker, d1-worker, web3-wallet-worker, agent-worker, email-worker)
- `dashboard` — dashboard service only
- `db` — (reserved for future: local D1 emulator, Redis, etc.)
- `full` — workers + dashboard (shorthand for --profile workers --profile dashboard)

### DockerService Methods

```typescript
class DockerService {
  /** Returns { docker: bool, compose: bool } for both availability checks */
  async checkAvailability(): Promise<{ docker: boolean; compose: boolean }>

  /** Run `docker compose --profile X --profile Y up -d` with given profiles */
  async composeUp(profiles: string[]): Promise<WranglerResult<void>>

  /** Run `docker compose down` */
  async composeDown(): Promise<WranglerResult<void>>

  /** Run `docker compose ps` */
  async composeStatus(): Promise<WranglerResult<string>>
}
```

## CLI Interface

```bash
hoox dev start [--runtime native|docker]
hoox dev dashboard [--runtime native|docker]
hoox dev worker <name> [--runtime native|docker]
```

- `--runtime` flag: overrides saved preference, bypasses prompt
- No `--runtime`: uses saved preference from `wrangler.jsonc.dev.runtime`, prompts if none saved

## Menu Integration

Update `showDevelopMenu()` in `menu.ts`:

```typescript
options: [
  { value: "dev start", label: "Start dev server", hint: "runs all workers locally" },
  // → pass through as `dev start` (runtime handled by command itself)
  { value: "init", label: "Init project", hint: "bootstrap new project" },
]
```

The command handles runtime selection internally — no menu changes needed.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Wrangler not installed | Show error + install hint (`bun add -g wrangler`) |
| Can't fetch latest version | Log warning, continue (don't block) |
| Docker available but compose file missing | Fall back to Native, log warning |
| Docker compose up fails | Show error, exit with code |
| Compose file invalid | Show error from `docker compose config`, exit |

## Files to Create/Modify

### New Files

- `packages/cli/src/services/prerequisites/index.ts` — PrerequisitesService
- `packages/cli/src/services/prerequisites/types.ts` — Result types
- `packages/cli/src/services/docker/index.ts` — DockerService

### Modified Files

- `packages/cli/src/commands/dev/dev-command.ts` — runtime selection + service integration
- `packages/cli/src/ui/menu.ts` — (no changes needed — command handles selection)
- `docker-compose.yml` — add profiles to all services
- `wrangler.jsonc` — (schema update, not a file change)
- `wrangler.jsonc.example` — document `dev` section

## Testing

1. Unit test `PrerequisitesService` with mocked `Bun.spawn` for version checks
2. Unit test `DockerService.checkAvailability()` with mocked spawns
3. Integration test for full flow: version check → runtime prompt → launch
4. Test flag override: `hoox dev start --runtime docker` bypasses prompt
5. Test preference persistence: setting persists to `wrangler.jsonc`

## Exit Criteria

- [ ] `hoox dev start` checks wrangler version and shows advisory warning if outdated
- [ ] Docker/Docker Compose availability is checked before offering Docker option
- [ ] Interactive prompt appears when Docker is viable and no preference saved
- [ ] `--runtime` flag overrides saved preference
- [ ] Runtime preference persists to `wrangler.jsonc`
- [ ] Docker mode launches via `docker compose --profile workers --profile dashboard up`
- [ ] Native mode uses existing `CloudflareService.dev()` flow
- [ ] `docker-compose.yml` has `workers`, `dashboard`, `full` profiles
- [ ] All existing tests pass