#!/bin/bash
# helpers.sh — Collection of helper functions for the hoox monorepo
#
# Usage:  source scripts/helpers.sh
#         wx "wrangler types"

# ── Self-directory (captured at source time, works in bash & zsh) ─
# In bash: BASH_SOURCE[0] gives the sourced file path.
# In zsh:  $0 at the top level gives the sourced file path.
_helpers_self="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd 2>/dev/null)"

# wx — Run a CLI command in every worker directory
#
# Iterates over subdirectories of the workers root and executes
# the given command inside each one. Prints a clear per-worker
# summary with exit codes.
#
# Usage:  wx <command>
#
# Examples:
#   wx "wrangler types"
#   wx "pnpm run typecheck"
#   wx "cat package.json | jq .name"
#   wx "ls -la src/"
#   wx "wrangler deploy --dry-run"
#
# Environment:
#   WX_WORKERS_DIR   Override the workers root path
#                    (default: ../workers relative to this script)
#   WX_FILTER        Glob filter — only run in matching dir names
#                    (e.g. WX_FILTER='*-worker' wx "wrangler types")
wx() {
  local cmd="$*"
  if [[ -z "$cmd" ]]; then
    echo "Usage: wx <command>" >&2
    echo "Runs the given command in every worker directory." >&2
    return 1
  fi

  # Resolve the workers directory (relative to this script's location)
  local scripts_dir="$_helpers_self"
  local workers_dir="${WX_WORKERS_DIR:-$(cd "$scripts_dir/../workers" && pwd)}"

  if [[ ! -d "$workers_dir" ]]; then
    echo "wx: Workers directory not found: $workers_dir" >&2
    echo "    Set WX_WORKERS_DIR to the correct path." >&2
    return 1
  fi

  # Gather subdirectories
  local dirs=()
  for d in "$workers_dir"/*/; do
    [[ -d "$d" ]] && dirs+=("$d")
  done

  if [[ ${#dirs[@]} -eq 0 ]]; then
    echo "wx: No directories found in $workers_dir" >&2
    return 1
  fi

  local total=0 failed=0 name
  for dir in "${dirs[@]}"; do
    name="$(basename "$dir")"

    # Apply optional glob filter (bash & zsh compatible)
    if [[ -n "$WX_FILTER" ]]; then
      if [[ -n "$ZSH_VERSION" ]]; then
        # zsh needs ~ prefix to force glob expansion on variable
        case "$name" in
          ${~WX_FILTER}) ;;
          *) continue ;;
        esac
      else
        case "$name" in
          $WX_FILTER) ;;
          *) continue ;;
        esac
      fi
    fi

    echo "─── $name ───"
    total=$((total + 1))

    if (cd "$dir" && eval "$cmd"); then
      echo "✔ $name — OK"
    else
      local ec=$?
      echo "✖ $name — exit code $ec"
      failed=$((failed + 1))
    fi
    echo
  done

  echo "───────────────────────────────────────"
  echo "Done: $total dirs, $failed failed"
  [[ $failed -eq 0 ]]
}
