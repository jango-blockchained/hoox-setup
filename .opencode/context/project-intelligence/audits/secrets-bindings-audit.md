<!-- Context: project-intelligence/audits | Priority: high | Version: 1.0 | Updated: 2026-05-19 -->

# Secrets & Bindings Audit — 2026-05-19

**Scope**: Cross-project audit of secrets, environment variables, service bindings, `.dev.vars`, `wrangler.jsonc`, docs, and naming patterns across all 10 workers.

**Method**: Source code (`env.*` reads) × per-worker `wrangler.jsonc` `vars` × root `wrangler.jsonc` `secrets` × `.dev.vars` × `.env.example` × 4 doc sources

---

## Table of Contents

1. [Critical Issues (Broken Auth)](#1-critical-issues)
2. [Naming Pattern Mismatches](#2-naming-pattern-mismatches)
3. [Unused Declarations](#3-unused-declarations)
4. [Service Binding Mesh (Reality vs Docs)](#4-service-binding-mesh)
5. [Stale .dev.vars.example Files](#5-stale-devvarsexample-files)
6. [Missing Config Files](#6-missing-config-files)
7. [Doc Inaccuracies](#7-doc-inaccuracies)
8. [Fix Plan](#8-fix-plan)

---

## 1. Critical Issues

### C1: d1-worker — Auth Silently Disabled

| Aspect                        | Detail                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Code**                      | `d1-worker/src/index.ts` calls `requireInternalAuth(request, env, "INTERNAL_KEY_BINDING")`                                      |
| **Code reads**                | `env.INTERNAL_KEY_BINDING`                                                                                                      |
| **wrangler.jsonc vars**       | `INTERNAL_KEY_BINDING: "__SECRET__"`                                                                                            |
| **worker-configuration.d.ts** | `INTERNAL_KEY_BINDING: string`                                                                                                  |
| **Result**                    | `env["INTERNAL_KEY_BINDING"]` is always `undefined` → `requireInternalAuth` returns `null` → **all requests pass without auth** |
| **Fix**                       | Rename wrangler var from `INTERNAL_KEY_BINDING` → `INTERNAL_KEY_BINDING` to match code + standardization                        |

### C2: trade-worker — Outbound Auth to telegram-worker Broken

| Aspect                        | Detail                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Code**                      | `notifications.ts`/`execution.ts` reads `env.TELEGRAM_INTERNAL_KEY_BINDING`                                                               |
| **Code reads**                | `env.TELEGRAM_INTERNAL_KEY_BINDING`                                                                                                       |
| **wrangler.jsonc vars**       | ❌ **Not declared**                                                                                                                       |
| **worker-configuration.d.ts** | ❌ **Not declared**                                                                                                                       |
| **Result**                    | `env.TELEGRAM_INTERNAL_KEY_BINDING` is `undefined` → outbound `X-Internal-Auth-Key` header never set → telegram-worker rejects or ignores |
| **Fix**                       | Add `TELEGRAM_INTERNAL_KEY_BINDING: "__SECRET__"` to trade-worker wrangler.jsonc vars                                                     |

### C3: analytics-worker — CLOUDFLARE_API_TOKEN Missing

| Aspect                        | Detail                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| **Code**                      | `src/executeQuery` reads `env.CLOUDFLARE_API_TOKEN`                                                |
| **wrangler.jsonc vars**       | ❌ **Not declared** (only `CLOUDFLARE_ACCOUNT_ID` is there)                                        |
| **worker-configuration.d.ts** | Wrong: `CF_ACCOUNT_ID` instead of `CLOUDFLARE_ACCOUNT_ID`                                          |
| **Result**                    | `CLOUDFLARE_API_TOKEN` is `undefined` → Analytics Engine SQL queries fail in production            |
| **Fix**                       | Add `CLOUDFLARE_API_TOKEN: "__SECRET__"` to analytics-worker wrangler.jsonc vars; regenerate types |

---

## 2. Naming Pattern Mismatches

The project has **3 competing naming conventions** for the same secrets depending on where you look:

| Convention              | Pattern                                                            | Used In                                                       |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| **A: `_KEY`/`_SECRET`** | `BINANCE_KEY_BINDING`, `MEXC_SECRET_BINDING`                       | Root `wrangler.jsonc` `secrets` array, `.env.example`         |
| **B: `_BINDING`**       | `BINANCE_KEY_BINDING`, `MEXC_KEY_BINDING`, `INTERNAL_KEY_BINDING`  | Code (`env.*` reads), per-worker `wrangler.jsonc` `vars`      |
| **C: `_INTERNAL_KEY`**  | `INTERNAL_KEY_BINDING`, `AGENT_INTERNAL_KEY`, `TRADE_INTERNAL_KEY` | Dashboard `process.env`, `.env.example` internal auth section |

### Specific Mismatch Table

| Concept               | Code uses                                                                                | Per-worker wrangler vars       | Root wrangler secrets                                                                       | .env.example              | Problem                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| Exchange keys         | `BINANCE_KEY_BINDING`, `BINANCE_SECRET_BINDING`, `MEXC_KEY_BINDING`, ...                 | ✅ `BINANCE_KEY_BINDING`, etc. | ❌ `BINANCE_KEY_BINDING`, `BINANCE_SECRET_BINDING`, `MEXC_KEY_BINDING` ...                  | ❌ `BINANCE_KEY_BINDING`  | `hoox secrets update-cf` will set wrong names; runtime will get `undefined` |
| Telegram bot token    | `TG_BOT_TOKEN_BINDING`                                                                   | ✅ `TG_BOT_TOKEN_BINDING`      | ❌ `TG_BOT_TOKEN_BINDING`                                                                   | ❌ `TG_BOT_TOKEN_BINDING` | Mismatch between root secrets name and code-expected name                   |
| Email secrets         | `EMAIL_HOST_BINDING`, `EMAIL_USER_BINDING`, `EMAIL_PASS_BINDING`, `INTERNAL_KEY_BINDING` | ✅ with `_BINDING`             | ❌ `EMAIL_HOST_BINDING`, `EMAIL_USER_BINDING`, `EMAIL_PASS_BINDING`, `INTERNAL_KEY_BINDING` | ❌ not listed             | Root declares bare names; code expects `_BINDING`                           |
| Internal auth (d1)    | `INTERNAL_KEY_BINDING`                                                                   | ❌ `INTERNAL_KEY_BINDING`      | ✅ (not listed explicitly)                                                                  | ❌ `INTERNAL_KEY_BINDING` | Name mismatch — C1                                                          |
| Internal auth (agent) | `INTERNAL_KEY_BINDING` or `AGENT_INTERNAL_KEY` (fallback)                                | ✅ both declared               | ✅ `AGENT_INTERNAL_KEY`                                                                     | ❌ `AGENT_INTERNAL_KEY`   | Works via fallback, but dual-named is confusing                             |
| Telegram secret token | `TELEGRAM_SECRET_TOKEN`                                                                  | ✅ `TELEGRAM_SECRET_TOKEN`     | ✅ listed in docs                                                                           | ❌ not in .env.example    | Docs-only, but consistent                                                   |

### Internal Key Auth: Inter-Worker Trust Matrix

```
Sender                          │ Sends as X-Internal-Auth-Key    │ Receiver validates against
────────────────────────────────┼────────────────────────────────┼─────────────────────────────────
hoox                            │ env.INTERNAL_KEY_BINDING        │ trade-worker: INTERNAL_KEY_BINDING
hoox                            │ env.INTERNAL_KEY_BINDING        │ telegram-worker: INTERNAL_KEY_BINDING
trade-worker                    │ env.TELEGRAM_INTERNAL_KEY_BINDING│ telegram-worker: INTERNAL_KEY_BINDING  ⚠️ C2
agent-worker                    │ env.INTERNAL_KEY_BINDING        │ trade-worker: INTERNAL_KEY_BINDING
agent-worker                    │ env.INTERNAL_KEY_BINDING        │ d1-worker: ??? (INTERNAL_KEY_BINDING ≠ INTERNAL_KEY_BINDING) 🔴 C1
agent-worker                    │ env.INTERNAL_KEY_BINDING        │ telegram-worker: INTERNAL_KEY_BINDING
email-worker                    │ env.INTERNAL_KEY_BINDING        │ trade-worker: INTERNAL_KEY_BINDING
dashboard (ApiClient via URL)   │ process.env.INTERNAL_KEY_BINDING     │ d1-worker: ??? 🔴 C1
dashboard (ApiClient via URL)   │ process.env.AGENT_INTERNAL_KEY  │ agent-worker: INTERNAL_KEY_BINDING ⚠️
dashboard (ApiClient via URL)   │ process.env.API_SERVICE_KEY     │ trade-worker: API_SERVICE_KEY... maybe?
```

---

## 3. Unused Declarations

| Variable/Binding                    | Worker             | Declared In                  | Status                               |
| ----------------------------------- | ------------------ | ---------------------------- | ------------------------------------ |
| `ANALYTICS_SERVICE` service binding | hoox               | wrangler.jsonc services      | Unused in code                       |
| `ANALYTICS_SERVICE` service binding | d1-worker          | wrangler.jsonc services      | Unused in code                       |
| `ANALYTICS_SERVICE` service binding | telegram-worker    | wrangler.jsonc services      | Unused in code                       |
| `ANALYTICS_SERVICE` service binding | web3-wallet-worker | wrangler.jsonc services      | Unused in code                       |
| `ANALYTICS_SERVICE` service binding | email-worker       | wrangler.jsonc services      | Unused in code                       |
| `HA_TOKEN_BINDING`                  | hoox               | wrangler.jsonc vars          | Unused in code                       |
| `TG_CHAT_ID_BINDING`                | telegram-worker    | wrangler.jsonc vars          | Unused (chat IDs read from KV)       |
| `TRADE_WORKER_NAME`                 | email-worker       | wrangler.jsonc vars          | Unused in code                       |
| `EMAIL_SCAN_SUBJECT`                | email-worker       | wrangler.jsonc vars          | Unused (read from KV)                |
| `NEXT_INC_CACHE_KV`                 | dashboard          | wrangler.jsonc kv_namespaces | Unused in code                       |
| `BROWSER: Fetcher`                  | trade-worker       | worker-configuration.d.ts    | Not in wrangler.jsonc (phantom type) |
| `BROWSER: Fetcher`                  | web3-wallet-worker | worker-configuration.d.ts    | Not in wrangler.jsonc (phantom type) |
| `VECTORIZE_INDEX`                   | trade-worker       | worker-configuration.d.ts    | Not in wrangler.jsonc (phantom type) |

### Phantom Docs Entries (in `docs/devops/bindings.md` but don't exist anywhere)

| Entry                                    | Appears In Docs                                                | Actually Exists? |
| ---------------------------------------- | -------------------------------------------------------------- | ---------------- |
| `UNISWAP_API_KEY_BINDING`                | docs/devops/bindings.md                                        | ❌ No            |
| `ADMIN_API_KEY_BINDING`                  | docs/devops/bindings.md                                        | ❌ No            |
| `WEB3_RPC_URL_BINDING`                   | docs/devops/bindings.md                                        | ❌ No            |
| `WEBHOOK_RECEIVER_API` (telegram → hoox) | docs/devops/bindings.md + docs/devops/architecture/bindings.md | ❌ No            |
| `WEB3_WALLET_API` (telegram → web3)      | docs/devops/bindings.md                                        | ❌ No            |
| `WEB3_WALLET_WORKER` (trade → web3)      | docs/devops/bindings.md                                        | ❌ No            |
| `TRADE_SERVICE` (telegram → trade)       | docs/devops/bindings.md                                        | ❌ No            |

### Missing Bindings (exist in wrangler.jsonc but not in docs)

| Binding            | Source Worker | Target          | Missing From                                                   |
| ------------------ | ------------- | --------------- | -------------------------------------------------------------- |
| `D1_SERVICE`       | agent-worker  | d1-worker       | docs/devops/bindings.md                                        |
| `D1_SERVICE`       | report-worker | d1-worker       | docs/devops/bindings.md                                        |
| `D1_SERVICE`       | dashboard     | d1-worker       | docs/devops/bindings.md + .opencode/context lookup/bindings.md |
| `AGENT_SERVICE`    | dashboard     | agent-worker    | docs/devops/bindings.md                                        |
| `TRADE_SERVICE`    | agent-worker  | trade-worker    | docs/devops/bindings.md                                        |
| `TRADE_SERVICE`    | email-worker  | trade-worker    | docs/devops/bindings.md                                        |
| `TELEGRAM_SERVICE` | agent-worker  | telegram-worker | docs/devops/bindings.md                                        |
| `TELEGRAM_SERVICE` | report-worker | telegram-worker | docs/devops/bindings.md                                        |
| `TELEGRAM_SERVICE` | web3-wallet   | telegram-worker | docs/devops/bindings.md                                        |

---

## 4. Service Binding Mesh

### Actual (from 10 wrangler.jsonc files)

```
hoox ──TRADE_SERVICE──▶ trade-worker
hoox ──TELEGRAM_SERVICE──▶ telegram-worker
hoox ──ANALYTICS_SERVICE──▶ analytics-worker (UNUSED)

trade-worker ──D1_SERVICE──▶ d1-worker
trade-worker ──TELEGRAM_SERVICE──▶ telegram-worker
trade-worker ──ANALYTICS_SERVICE──▶ analytics-worker

agent-worker ──D1_SERVICE──▶ d1-worker
agent-worker ──TRADE_SERVICE──▶ trade-worker
agent-worker ──TELEGRAM_SERVICE──▶ telegram-worker

telegram-worker ──ANALYTICS_SERVICE──▶ analytics-worker (UNUSED)
d1-worker ──ANALYTICS_SERVICE──▶ analytics-worker (UNUSED)
web3-wallet-worker ──TELEGRAM_SERVICE──▶ telegram-worker
web3-wallet-worker ──ANALYTICS_SERVICE──▶ analytics-worker (UNUSED)
email-worker ──TRADE_SERVICE──▶ trade-worker
email-worker ──ANALYTICS_SERVICE──▶ analytics-worker (UNUSED)
report-worker ──D1_SERVICE──▶ d1-worker
report-worker ──TELEGRAM_SERVICE──▶ telegram-worker
dashboard ──D1_SERVICE──▶ d1-worker
dashboard ──AGENT_SERVICE──▶ agent-worker
```

### Port Assignments (local dev)

| Worker             | Port |
| ------------------ | ---- |
| hoox               | 8787 |
| trade-worker       | 8789 |
| telegram-worker    | 8791 |
| d1-worker          | 8792 |
| web3-wallet-worker | 8793 |
| dashboard          | 8794 |
| agent-worker       | 8795 |
| email-worker       | 8796 |
| report-worker      | 8797 |

---

## 5. Stale .dev.vars.example Files

| File                                           | Current Content Uses                                                                   | Code Expects                                                                                                                                                    | Freshness                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `workers/hoox/.dev.vars.example`               | `INTERNAL_KEY_BINDING`, `WEBHOOK_API_KEY_BINDING`, `TRADE_SERVICE`, `TELEGRAM_SERVICE` | `WEBHOOK_API_KEY_BINDING`, `INTERNAL_KEY_BINDING`, `HA_TOKEN_BINDING`                                                                                           | ❌ Stale                                                             |
| `workers/trade-worker/.dev.vars.example`       | `BINANCE_KEY_BINDING`, `MEXC_KEY_BINDING`, `BYBIT_KEY_BINDING`, `D1_SERVICE`           | `INTERNAL_KEY_BINDING`, `BINANCE_KEY_BINDING`, `BINANCE_SECRET_BINDING`, `MEXC_KEY_BINDING`, `MEXC_SECRET_BINDING`, `BYBIT_KEY_BINDING`, `BYBIT_SECRET_BINDING` | ❌ Stale                                                             |
| `workers/telegram-worker/.dev.vars.example`    | `INTERNAL_KEY_BINDING`, `TG_BOT_TOKEN_BINDING`, `ALLOWED_CHAT_IDS`                     | `INTERNAL_KEY_BINDING`, `TG_BOT_TOKEN_BINDING`, `TELEGRAM_SECRET_TOKEN`                                                                                         | ❌ Stale                                                             |
| `workers/web3-wallet-worker/.dev.vars.example` | `WALLET_PK_SECRET`, `WALLET_MNEMONIC_SECRET`, `TELEGRAM_SERVICE`                       | `WALLET_PK_SECRET`, `WALLET_MNEMONIC_SECRET`                                                                                                                    | ✅ Correct names (has extra `TELEGRAM_SERVICE` which isn't a secret) |

---

## 6. Missing Config Files

| File                              | Status                  | Impact                                                                                |
| --------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `workers/report-worker/.dev.vars` | ❌ **Missing**          | Cannot test report-worker locally; `CF_API_TOKEN_BINDING` is `null` in wrangler.jsonc |
| `workers/d1-worker/.dev.vars`     | ✅ Exists but **empty** | No local test values for `INTERNAL_KEY_BINDING` (after C1 fix)                        |

---

## 7. Doc Inaccuracies

| Doc                                                         | Issue                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/devops/bindings.md`                                   | 3 phantom secrets (`UNISWAP_API_KEY_BINDING`, `ADMIN_API_KEY_BINDING`, `WEB3_RPC_URL_BINDING`); service binding mesh missing 8+ real bindings; lists 3 phantom service bindings (`WEBHOOK_RECEIVER_API`, `WEB3_WALLET_API`, `WEB3_WALLET_WORKER`); claims Telegram→Trade, Telegram→Web3 which don't exist |
| `docs/devops/architecture/bindings.md`                      | Same phantom issues; missing agent/dashboard/report/email service bindings; port assignments differ from actual local-dev docs                                                                                                                                                                            |
| `docs/devops/architecture/overview.md`                      | Claims "All internal workers use same `INTERNAL_KEY_BINDING`" — not true for d1-worker (uses `INTERNAL_KEY_BINDING`)                                                                                                                                                                                      |
| `docs/devops/setup_and_operations.md`                       | Secret inventory table (3.1) uses root wrangler.jsonc secret names, not the `_BINDING` names that code actually reads; dashboard secrets not listed                                                                                                                                                       |
| `.opencode/context/project-intelligence/lookup/bindings.md` | Missing `D1_SERVICE` for dashboard; missing `AGENT_SERVICE`                                                                                                                                                                                                                                               |
| Per-worker docs (8 files)                                   | Various stale secret references                                                                                                                                                                                                                                                                           |

---

## 8. Fix Plan

### Phase 1: 🔴 Critical (Security — auth is broken now)

| #   | Task                                                                                              | Files                                                | Priority |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| 1.1 | Fix d1-worker auth: rename `INTERNAL_KEY_BINDING` → `INTERNAL_KEY_BINDING` in wrangler.jsonc vars | `workers/d1-worker/wrangler.jsonc`                   | P0       |
| 1.2 | Fix d1-worker auth: regenerate worker-configuration.d.ts                                          | `workers/d1-worker/worker-configuration.d.ts`        | P0       |
| 1.3 | Fix trade-worker outbound auth: add `TELEGRAM_INTERNAL_KEY_BINDING` to wrangler.jsonc vars        | `workers/trade-worker/wrangler.jsonc`                | P0       |
| 1.4 | Fix trade-worker: regenerate worker-configuration.d.ts                                            | `workers/trade-worker/worker-configuration.d.ts`     | P0       |
| 1.5 | Fix analytics-worker: add `CLOUDFLARE_API_TOKEN` to wrangler.jsonc vars                           | `workers/analytics-worker/wrangler.jsonc`            | P0       |
| 1.6 | Fix analytics-worker: regenerate worker-configuration.d.ts                                        | `workers/analytics-worker/worker-configuration.d.ts` | P0       |

### Phase 2: 🟡 Naming Standardization

| #   | Task                                                                                                                                                                                                                                   | Files                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 2.1 | Standardize trade-worker exchange secrets in root wrangler.jsonc: change `BINANCE_KEY_BINDING`/`BINANCE_SECRET_BINDING`/etc → `BINANCE_KEY_BINDING`/`BINANCE_SECRET_BINDING`/etc                                                       | `wrangler.jsonc`                            |
| 2.2 | Standardize email secrets in root wrangler.jsonc: change `EMAIL_HOST_BINDING`/`EMAIL_USER_BINDING`/`EMAIL_PASS_BINDING`/`INTERNAL_KEY_BINDING` → `EMAIL_HOST_BINDING`/`EMAIL_USER_BINDING`/`EMAIL_PASS_BINDING`/`INTERNAL_KEY_BINDING` | `wrangler.jsonc`                            |
| 2.3 | Standardize telegram secret in root wrangler.jsonc: change `TG_BOT_TOKEN_BINDING` → `TG_BOT_TOKEN_BINDING`                                                                                                                             | `wrangler.jsonc`                            |
| 2.4 | Update `.env.example` to use `_BINDING` suffixed names for exchange secrets + add telegram/email vars                                                                                                                                  | `.env.example`                              |
| 2.5 | Update hoox `.dev.vars.example` to current naming                                                                                                                                                                                      | `workers/hoox/.dev.vars.example`            |
| 2.6 | Update trade-worker `.dev.vars.example` to current naming                                                                                                                                                                              | `workers/trade-worker/.dev.vars.example`    |
| 2.7 | Update telegram-worker `.dev.vars.example` to current naming                                                                                                                                                                           | `workers/telegram-worker/.dev.vars.example` |

### Phase 3: 🔵 Clean Up Unused Declarations

| #    | Task                                                                             | Files                                       |
| ---- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| 3.1  | Remove unused `ANALYTICS_SERVICE` binding from hoox wrangler.jsonc               | `workers/hoox/wrangler.jsonc`               |
| 3.2  | Remove unused `ANALYTICS_SERVICE` binding from d1-worker wrangler.jsonc          | `workers/d1-worker/wrangler.jsonc`          |
| 3.3  | Remove unused `ANALYTICS_SERVICE` binding from telegram-worker wrangler.jsonc    | `workers/telegram-worker/wrangler.jsonc`    |
| 3.4  | Remove unused `ANALYTICS_SERVICE` binding from web3-wallet-worker wrangler.jsonc | `workers/web3-wallet-worker/wrangler.jsonc` |
| 3.5  | Remove unused `ANALYTICS_SERVICE` binding from email-worker wrangler.jsonc       | `workers/email-worker/wrangler.jsonc`       |
| 3.6  | Remove unused `HA_TOKEN_BINDING` from hoox wrangler.jsonc vars                   | `workers/hoox/wrangler.jsonc`               |
| 3.7  | Remove unused `TG_CHAT_ID_BINDING` from telegram-worker wrangler.jsonc vars      | `workers/telegram-worker/wrangler.jsonc`    |
| 3.8  | Remove unused `TRADE_WORKER_NAME` from email-worker wrangler.jsonc vars          | `workers/email-worker/wrangler.jsonc`       |
| 3.9  | Remove unused `EMAIL_SCAN_SUBJECT` from email-worker wrangler.jsonc vars         | `workers/email-worker/wrangler.jsonc`       |
| 3.10 | Remove unused `NEXT_INC_CACHE_KV` from dashboard wrangler.jsonc                  | `workers/dashboard/wrangler.jsonc`          |
| 3.11 | Add missing `AI` binding to dashboard wrangler.jsonc                             | `workers/dashboard/wrangler.jsonc`          |

### Phase 4: 🟢 Fix Missing Config

| #   | Task                                                                             | Files                             |
| --- | -------------------------------------------------------------------------------- | --------------------------------- |
| 4.1 | Create `workers/report-worker/.dev.vars` with `CF_API_TOKEN_BINDING=placeholder` | `workers/report-worker/.dev.vars` |
| 4.2 | Populate `workers/d1-worker/.dev.vars` with `INTERNAL_KEY_BINDING=placeholder`   | `workers/d1-worker/.dev.vars`     |

### Phase 5: 📚 Fix Documentation

| #   | Task                                                                                              | Files                                  |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 5.1 | Fix `docs/devops/bindings.md`: remove phantom entries, add missing bindings, correct service mesh | `docs/devops/bindings.md`              |
| 5.2 | Fix `docs/devops/architecture/bindings.md`: same corrections                                      | `docs/devops/architecture/bindings.md` |
| 5.3 | Fix `docs/devops/setup_and_operations.md` Secret Inventory to use `_BINDING` naming               | `docs/devops/setup_and_operations.md`  |
| 5.4 | Fix `docs/devops/architecture/overview.md` auth standardization claim                             | `docs/devops/architecture/overview.md` |
| 5.5 | Fix `.opencode/context/project-intelligence/lookup/bindings.md`                                   | `lookup/bindings.md`                   |

### Phase 6: ⚪ Regenerate Types (Final)

| #   | Task                                                                             | Files       |
| --- | -------------------------------------------------------------------------------- | ----------- |
| 6.1 | Run `wrangler types` for all 9 workers to regenerate `worker-configuration.d.ts` | All workers |

---

## Dependencies

```
Phase 1 (Critical Fixes)
  ├── 1.1 → 1.2 (d1-worker auth → regenerate types)
  ├── 1.3 → 1.4 (trade-worker auth → regenerate types)
  └── 1.5 → 1.6 (analytics-worker → regenerate types)

Phase 2 (Naming) — depends on Phase 1 (to avoid regressions)
  ├── 2.1 → (root wrangler trade secrets rename)
  ├── 2.2 → (root wrangler email secrets rename)
  ├── 2.3 → (root wrangler telegram secret rename)
  ├── 2.4 → (.env.example update)
  ├── 2.5 → (hoox .dev.vars.example)
  ├── 2.6 → (trade .dev.vars.example)
  └── 2.7 → (telegram .dev.vars.example)

Phase 3 (Cleanup) — depends on Phase 2
  ├── 3.1–3.5 (remove ANALYTICS_SERVICE bindings)
  ├── 3.6–3.9 (remove unused vars)
  ├── 3.10 (remove NEXT_INC_CACHE_KV)
  └── 3.11 (add AI binding to dashboard)

Phase 4 (Missing Config) — independent
  ├── 4.1 (report-worker .dev.vars)
  └── 4.2 (d1-worker .dev.vars)

Phase 5 (Docs) — depends on Phase 1+2 (to document correct names)
  ├── 5.1 (bindings.md)
  ├── 5.2 (architecture/bindings.md)
  ├── 5.3 (setup_and_operations.md)
  ├── 5.4 (architecture/overview.md)
  └── 5.5 (lookup/bindings.md)

Phase 6 (Types) — depends on all other phases
  └── 6.1 (wrangler types --all)
```
