# CLI Service Architecture

Services encapsulate Cloudflare CLI and API interactions. Located in `packages/cli/src/services/`.

## CloudflareService (`cloudflare-service.ts`)

Wraps `wrangler` CLI via `Bun.spawn()`. Methods return `WranglerResult<T>` (discriminated union).

**Categories:**
- Auth: `whoami()`, `login()`
- Deploy: `deploy(path, env?)` → returns URL, size, startupTime, versionId
- Dev: `dev(args)` → spawns wrangler dev
- D1: `d1List()`, `d1Create(name)`, `d1Delete(name)`
- KV: `kvList()`, `kvCreate(name)`, `kvDelete(name)`
- R2: `r2List()`, `r2Create(name)`, `r2Delete(name)`
- Queues: `queueList()`, `queueCreate(name)`, `queueDelete(name)`
- Vectorize: `vectorizeList()`, `vectorizeCreate(name)`, `vectorizeDelete(name)`
- Analytics: `analyticsList()`, `analyticsCreate(name)` (returns instructions — wrangler limitation)

## DbService (`db/db-service.ts`)

Wraps `wrangler d1` commands. Resolves database name from `d1-worker` config.

- `resolveDbName()` — read from wrangler.jsonc `d1-worker.vars.database_name`
- `apply(dbName, remote, schemaPath?)` — apply schema.sql
- `migrate(dbName, remote)` — run tracking migration
- `listTables(dbName, remote)` — list D1 tables
- `query(dbName, sql, remote)` — execute read-only SQL (--json output)
- `export(dbName, outputPath?)` — export to .sql file with timestamp
- `reset(dbName)` — delete + recreate D1 (DESTRUCTIVE)

## KvSyncService (`kv/kv-sync-service.ts`)

KV key management with embedded 16-key manifest.

- `resolveNamespaceId()` — find CONFIG_KV from `wrangler kv:namespace list`
- `list(namespaceId)` — list all keys
- `get(namespaceId, key)` — get key value
- `set(namespaceId, key, value)` — set key
- `delete(namespaceId, key)` — delete key
- Static `getManifest()` — returns 16-key default manifest
- Static `getManifestKeys()` — returns keys array

## SecretsService (`secrets/secrets-service.ts`)

Factory-based: use `SecretsService.create(configPath?)`. Reads secret definitions from wrangler.jsonc.

- `listSecrets(workerName)` — get secret names for a worker
- `listAllSecrets()` — all workers → secret names map
- `checkLocalSecrets(workerName)` — check .dev.vars for real values
- `syncToCloudflare(workerName)` — upload secrets from .dev.vars to CF
- `generateDevVars(workerName)` — create .dev.vars template

## EnvService (`env/env-service.ts`)

31 env var definitions across 8 sections. Stateless (static methods).

- `getDefinitions()` → EnvVarDefinition[] with name, required, secret, section, default, hint
- `getSections()` → unique section names
- `loadDotEnvAsync(path)` → parse .env file
- `validate(vars)` → check required, session length
- `generateEnvLocal(vars?)` → full .env.local content
- `getWorkerDevVars(vars)` → per-worker .dev.vars content
- `show(vars)` → formatted display with redacted secrets

## MonitorService (`commands/monitor/monitor-service.ts`)

HTTP health check service.

- `checkAllWorkerHealth()` — fetch /health for each enabled worker. Returns health/degraded/unreachable counts.

## RepairService (`commands/repair/repair-service.ts`)

Orchestration service running system checks.

- `runSystemCheck()` — 5-step check: submodules, deps, typecheck, infra, secrets

## TelegramService (`commands/deploy/telegram-service.ts`)

Telegram Bot API wrapper.

- `setWebhook(token, url, secretToken)` — POST /setWebhook
- `getWebhookInfo(token)` — GET /getWebhookInfo
