#!/bin/bash
# install.sh — Install hoox helper functions into your shell config
#
# Detects your shell (bash / zsh), appends a "source" line for
# helpers.sh to the correct rc file, and sources it immediately.
#
# Usage:  bash scripts/install.sh
#         ./scripts/install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPERS_PATH="$SCRIPT_DIR/helpers.sh"

# ── Validate helpers.sh ──────────────────────────────────────────
if [[ ! -f "$HELPERS_PATH" ]]; then
  echo "ERROR: helpers.sh not found at $HELPERS_PATH" >&2
  exit 1
fi

# ── Detect shell & rc file ───────────────────────────────────────
detect_rc() {
  local shell_name
  shell_name="$(basename "$SHELL")"

  case "$shell_name" in
    zsh)
      echo "$HOME/.zshrc"
      ;;
    bash)
      # Prefer .bashrc; fall back to .bash_profile
      if [[ -f "$HOME/.bashrc" ]]; then
        echo "$HOME/.bashrc"
      elif [[ -f "$HOME/.bash_profile" ]]; then
        echo "$HOME/.bash_profile"
      else
        echo "$HOME/.bashrc"
      fi
      ;;
    *)
      echo ""
      ;;
  esac
}

RC_FILE="$(detect_rc)"

if [[ -z "$RC_FILE" ]]; then
  echo "Unsupported shell: $(basename "$SHELL")" >&2
  echo "Manually add this line to your shell config:" >&2
  echo "  source \"$HELPERS_PATH\"" >&2
  exit 1
fi

# ── Check if already installed ───────────────────────────────────
MARKER="# ---- hoox worker helpers ----"
SOURCE_LINE="source \"$HELPERS_PATH\""

if grep -qF "$SOURCE_LINE" "$RC_FILE" 2>/dev/null; then
  echo "✔ helpers.sh already installed in $RC_FILE"
  source "$HELPERS_PATH"
  echo "✔ helpers.sh sourced into current session"
  exit 0
fi

# ── Install ──────────────────────────────────────────────────────
{
  echo ""
  echo "$MARKER"
  echo "$SOURCE_LINE"
} >> "$RC_FILE"

echo "✔ Installed in $RC_FILE"
echo "   $SOURCE_LINE"

# ── Source into current session ─────────────────────────────────-
# shellcheck source=/dev/null
source "$HELPERS_PATH" 2>/dev/null || {
  echo "⚠  Could not source helpers.sh automatically." >&2
  echo "   Run: source \"$HELPERS_PATH\"" >&2
}

echo ""
echo "Done! wx() is ready to use."
echo ""
echo "Examples:"
echo "  wx \"wrangler types\""
echo "  wx \"pnpm run typecheck\""
echo "  wx \"ls -la src/\""
echo "  WX_FILTER='*-worker' wx \"wrangler deploy --dry-run\""
