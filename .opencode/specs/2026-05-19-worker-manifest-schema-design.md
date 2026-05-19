# Worker Manifest Schema Design

**Date:** 2026-05-19
**Status:** Approved

## 1. Purpose

Create a single source of truth for all 9 Cloudflare Workers' expected configuration — vars, secrets, service bindings, infrastructure bindings, and middleware usage — so the CLI can validate, generate, and repair worker configs out of the box.

## 2. Location

`packages/shared/src/schemas/` — accessible to both CLI and workers.
Spec doc: `.opencode/specs/2026-05-19-worker-manifest-schema-design.md`

## 3. Types (`types.ts`)

```typescript
export interface WorkerManifest {
  name: string;
  path: string;
  vars: Record<string, VarDef>;
  services: ServiceBindingDef[];
  infrastructure: InfraBindings;
  middleware: string[];
  cron?: string[];
}

export interface VarDef {
  type: "secret" | "plaintext";
  description: string;
  default?: string;
}

export interface ServiceBindingDef {
  binding: string;
  service: string;
  description: string;
}

export interface InfraBindings {
  kv?: { binding: string; description: string }[];
  d1?: { binding: string; database: string; description?: string }[];
  r2?: { binding: string; bucket: string; description?: string }[];
  queues?: { producer?: string[]; consumer?: string[] };
  ai?: boolean;
  vectorize?: { binding: string; index: string }[];
  analyticsEngine?: boolean;
  durableObjects?: { name: string; className: string }[];
  browser?: boolean;
}

export interface ValidationError {
  worker: string;
  severity: "error" | "warning";
  message: string;
  file?: string;
}
```

## 4. Registry (`registry.ts`)

Exports `WORKER_MANIFESTS: Record<string, WorkerManifest>` with all 9 workers: `hoox`, `trade-worker`, `telegram-worker`, `d1-worker`, `web3-wallet-worker`, `agent-worker`, `email-worker`, `analytics-worker`, `report-worker`, `dashboard`.

A `deriveCalledBy()` pure function computes the reverse mapping at export time by inverting the `services` field of every manifest.

Naming convention: all secret-based vars end in `_BINDING` (e.g. `INTERNAL_KEY_BINDING`, `BINANCE_KEY_BINDING`). Plaintext vars use descriptive names (`USE_IMAP`, `CLOUDFLARE_ACCOUNT_ID`).

### Workers detail

#### hoox

- **Secrets:** WEBHOOK_API_KEY_BINDING, INTERNAL_KEY_BINDING, HA_TOKEN_BINDING
- **Services:** TRADE_SERVICE (trade-worker), TELEGRAM_SERVICE (telegram-worker)
- **Infra:** KV (SESSIONS_KV, CONFIG_KV), D1 (none), Vectorize (VECTORIZE_INDEX), AI, Queues (producer: trade-execution), DO (IdempotencyStore)
- **Middleware:** requireAuth, requireInternalAuth, cors, rateLimit, logger, validate
- **Called by:** (public gateway)

#### trade-worker

- **Secrets:** INTERNAL_KEY_BINDING, TELEGRAM_INTERNAL_KEY_BINDING, BINANCE_KEY_BINDING, BINANCE_SECRET_BINDING, MEXC_KEY_BINDING, MEXC_SECRET_BINDING, BYBIT_KEY_BINDING, BYBIT_SECRET_BINDING
- **Services:** D1_SERVICE (d1-worker), TELEGRAM_SERVICE (telegram-worker)
- **Infra:** KV (CONFIG_KV), D1 (DB → trade-data-db), R2 (REPORTS_BUCKET, SYSTEM_LOGS_BUCKET), Queues (consumer: trade-execution)
- **Middleware:** requireInternalAuth
- **Called by:** hoox, agent-worker, email-worker

#### telegram-worker

- **Secrets:** INTERNAL_KEY_BINDING, TG_BOT_TOKEN_BINDING, TG_CHAT_ID_BINDING, TELEGRAM_SECRET_TOKEN
- **Services:** (none)
- **Infra:** KV (CONFIG_KV), R2 (UPLOADS_BUCKET), Vectorize (VECTORIZE_INDEX), AI
- **Middleware:** requireInternalAuth
- **Called by:** hoox, trade-worker, agent-worker, web3-wallet-worker, report-worker

#### d1-worker

- **Secrets:** INTERNAL_KEY_BINDING
- **Services:** (none)
- **Infra:** KV (CONFIG_KV), D1 (DB → trade-data-db)
- **Middleware:** requireInternalAuth
- **Called by:** trade-worker, agent-worker, report-worker, dashboard

#### web3-wallet-worker

- **Secrets:** WALLET_PK_SECRET, WALLET_MNEMONIC_SECRET
- **Services:** TELEGRAM_SERVICE (telegram-worker)
- **Infra:** (none)
- **Middleware:** requireInternalAuth
- **Called by:** (manual/API triggered)

#### agent-worker

- **Secrets:** AGENT_INTERNAL_KEY, INTERNAL_KEY_BINDING
- **Services:** TRADE_SERVICE (trade-worker), TELEGRAM_SERVICE (telegram-worker)
- **Infra:** KV (CONFIG_KV), D1 (DB → trade-data-db), AI
- **Middleware:** requireInternalAuth
- **Cron:** _/5 _ \* \* \*
- **Called by:** dashboard

#### email-worker

- **Secrets:** INTERNAL_KEY_BINDING, EMAIL_HOST_BINDING, EMAIL_USER_BINDING, EMAIL_PASS_BINDING
- **Services:** TRADE_SERVICE (trade-worker)
- **Infra:** KV (CONFIG_KV)
- **Plaintext vars:** TRADE_WORKER_NAME=trade-worker, USE_IMAP=false, MAILGUN_API_KEY, EMAIL_SCAN_SUBJECT
- **Middleware:** requireInternalAuth
- **Cron:** _/5 _ \* \* \*
- **Called by:** (cron/email triggered)

#### analytics-worker

- **Secrets:** CLOUDFLARE_API_TOKEN
- **Services:** (none)
- **Infra:** Analytics Engine (ANALYTICS_ENGINE → hoox-analytics)
- **Plaintext vars:** CLOUDFLARE_ACCOUNT_ID
- **Middleware:** (none)
- **Called by:** (API token auth)

#### report-worker

- **Secrets:** CF_API_TOKEN_BINDING
- **Services:** D1_SERVICE (d1-worker), TELEGRAM_SERVICE (telegram-worker)
- **Infra:** R2 (REPORTS_BUCKET)
- **Plaintext vars:** ACCOUNT_ID
- **Middleware:** requireInternalAuth
- **Cron:** 0 8 \* \* _, 0 18 _ \* \*
- **Called by:** (cron triggered)
- **Note:** Uses Browser Rendering via REST API (no binding)

#### dashboard

- **Secrets:** DASHBOARD_USER, DASHBOARD_PASS, SESSION_SECRET
- **Services:** D1_SERVICE (d1-worker), AGENT_SERVICE (agent-worker)
- **Infra:** KV (CONFIG_KV), AI
- **Middleware:** (none — Next.js app)
- **Called by:** (public UI via OpenNext)

## 5. Validators (`validators.ts`)

### Validate functions

| Function                                   | Input                            | Checks                                                                                       |
| ------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `validateWranglerJsonc(manifest, jsonc)`   | Per-worker wrangler.jsonc string | All vars present, no extras, service bindings match, infra bindings match, naming convention |
| `validateRootSecrets(manifest, rootJsonc)` | Root wrangler.jsonc string       | Secret list matches manifest vars of type `"secret"`                                         |
| `validateDevVars(manifest, content)`       | `.dev.vars` content              | All required vars present, no placeholders allowed for production                            |
| `validateCodeImports(manifest, source)`    | Worker `src/index.ts` content    | All declared middleware imported, no phantom imports                                         |
| `validateAll(manifest, files)`             | All sources                      | Aggregate report                                                                             |

### Generate functions

| Function                             | Output                                   |
| ------------------------------------ | ---------------------------------------- |
| `generateWranglerJsonc(manifest)`    | Complete per-worker wrangler.jsonc       |
| `generateDevVars(manifest)`          | `.dev.vars` with placeholder values      |
| `generateRootSecretsEntry(manifest)` | Secret name list for root wrangler.jsonc |
| `generateMarkdownTable(manifests)`   | Bindings reference table (for docs)      |

## 6. CLI Integration (`packages/cli/src/commands/schema/`)

New `hoox schema` subcommand:

```
hoox schema validate [worker]    Validate worker(s) against manifest
hoox schema generate [worker]    Write wrangler.jsonc / .dev.vars from manifest
hoox schema repair [worker]      Validate + auto-fix mismatches
hoox schema list                 List all workers with their binding counts
```

The existing `repair check` command will also invoke `schema validate` as an additional diagnostic step. The `secrets service` will be updated to optionally use the schema instead of only the root wrangler.jsonc.

## 7. Naming convention

All secret vars use `_BINDING` suffix (enforced by validator). Plaintext vars use camelCase or UPPER_SNAKE as appropriate. `deriveCalledBy()` uses exact worker name matching from the registry.

## 8. Migration path

1. Create `schemas/` directory with types + registry
2. Add validators (validate only, no generate yet)
3. Register `hoox schema` CLI command with validate + list
4. Refactor wizard presets to derive from registry
5. Add generate functions
6. Add repair command (validate + auto-fix)
7. Integrate into existing `repair check`
