# hoox-rename-bindings.py — Secrets & KV Rename Script

**Date**: 2026-05-19
**Status**: Draft

## Overview

A single Python script (`scripts/hoox-rename-bindings.py`) that reads the canonical worker manifest schema from `packages/shared/src/schemas/registry.ts`, detects old/deprecated secret and KV binding names across the project, and replaces them with canonical names.

## Architecture

Single-file Python script, stdlib only (`re`, `json`, `os`, `pathlib`, `argparse`, `json`).

## Core Components

### 1. Schema Reader (`parse_canonical_registry`)

Parses `packages/shared/src/schemas/registry.ts` using regex to extract:

- All secret var names (`type: "secret"`) per worker — the canonical names
- All infrastructure binding names (KV, R2, D1, service bindings, queues, vectorize)
- Returns a `CanonicalSchema` dict: `{worker_name: {vars: [...], services: [...], kv: [...], ...}}`

### 2. Name Mapper (`build_rename_map`)

Builds `old_name → canonical_name` from two sources:

- **Pattern derivation**: For each canonical `_BINDING` secret, derive old-name candidates:
  - Strip `_BINDING` → e.g., `BINANCE_KEY_BINDING` → `BINANCE_KEY_BINDING`
  - Replace with `_KEY` → e.g., `BINANCE_KEY_BINDING` → `BINANCE_KEY_KEY` (filtered out)
  - Replace with `_API_KEY` → `BINANCE_KEY_BINDING`
  - Replace with `_API_SECRET` → `BINANCE_SECRET_BINDING`
  - Strip `_BINDING` and append nothing → bare name like `EMAIL_HOST_BINDING`
- **Explicit overrides** (hard-coded for known patterns from audit):
  - `INTERNAL_KEY_BINDING → INTERNAL_KEY_BINDING`
  - `TRADE_INTERNAL_KEY → INTERNAL_KEY_BINDING` (or similar)
  - `TELEGRAM_INTERNAL_KEY → ...` (determined by context)

### 3. File Scanner (`scan_files`)

Walks the repo matching files by glob patterns. Excludes `.git/`, `node_modules/`, `.wrangler/`, `.next/`, `dist/`, `coverage/`, `.tmp/`, `.worktrees/`, `.ctx/`.

File types scanned:

- `*.jsonc` — wrangler configs
- `*.ts` — TypeScript source code
- `*.{env*,dev.vars*}` — environment files
- `*.md` — documentation

### 4. Rename Engine (`apply_renames`)

- **`--dry-run` (default)**: Scans and reports what would change without modifying files
- **`--apply`**: Performs replacements in-place with `.hoox-rename-backups/` for safety
- Word-boundary-aware replacements to avoid partial matches
- Skips binary files

### 5. Reporter (`print_report`)

Outputs:

- File-by-file diff of replacements
- Count of replacements per file/type
- Summary statistics (files scanned, files changed, total replacements)
- Exit code: 0 if nothing to change, 1 if mismatches found

## Usage

```bash
# Scan only (default)
python scripts/hoox-rename-bindings.py

# Apply changes
python scripts/hoox-rename-bindings.py --apply

# Verbose output
python scripts/hoox-rename-bindings.py --verbose

# Apply with extra caution (creates backups)
python scripts/hoox-rename-bindings.py --apply --backup
```

## Edge Cases

- **Already-correct names**: Left untouched (checked against canonical registry)
- **Validator exceptions**: `CLOUDFLARE_*`, `AGENT_INTERNAL_KEY`, `DASHBOARD_*`, `SESSION_SECRET`, `MAILGUN_API_KEY`, `TELEGRAM_SECRET_TOKEN`, `EMAIL_SCAN_SUBJECT` — excluded from rename heuristics
- **Partial substrings**: Word-boundary matching (`\b`) prevents `INTERNAL_KEY_BINDING` matching inside `TELEGRAM_INTERNAL_KEY_BINDING`
- **Binary files**: Skips non-text files
- **JSONC comments**: Preserved during replacement in JSONC files

## Files That Will Be Scanned

| Pattern                     | Example Files                 |
| --------------------------- | ----------------------------- |
| `workers/*/wrangler.jsonc`  | Per-worker Cloudflare config  |
| `wrangler.jsonc`            | Root Cloudflare config        |
| `.env.example`              | Global env template           |
| `workers/*/.dev.vars*`      | Per-worker local env files    |
| `workers/*/src/**/*.ts`     | TypeScript source (env reads) |
| `docs/**/*.md`              | Documentation                 |
| `.opencode/context/**/*.md` | AI context files              |
| `packages/**/src/**/*.ts`   | Shared/TUI/CLI source         |
| `tests/**/*.ts`             | Test files                    |
