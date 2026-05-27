#!/usr/bin/env bash
# Generate TypeDoc API documentation for public packages
# Uses pure CLI flags (no typedoc.json to avoid auto-discovery bugs)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec bun run typedoc \
  packages/shared/src/index.ts \
  packages/cli/src/index.ts \
  packages/tui/src/main.tsx \
  --tsconfig ./tsconfig.typedoc.json \
  --name "HOOX" \
  --out ./docs/api \
  --readme ./README.md \
  --excludePrivate \
  --excludeInternal \
  --excludeExternals \
  --categorizeByGroup \
  --searchInComments \
  --sort source-order \
  --skipErrorChecking \
  "$@"
