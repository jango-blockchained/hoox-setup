#!/usr/bin/env python3
"""
hoox-rename-bindings.py — Schema-driven secrets & KV binding rename tool.

Reads the canonical worker manifest schema from packages/shared/src/schemas/registry.ts,
scans the entire project for old/deprecated variable names, and replaces them
with canonical names.

Usage:
  python scripts/hoox-rename-bindings.py                # Scan only (dry run)
  python scripts/hoox-rename-bindings.py --apply         # Apply changes
  python scripts/hoox-rename-bindings.py --apply --backup # Apply with backups
  python scripts/hoox-rename-bindings.py --verbose       # Detailed output
"""

import re
import argparse
import shutil
from pathlib import Path
from datetime import datetime


# ─── Paths ─────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = PROJECT_ROOT / "packages/shared/src/schemas/registry.ts"
BACKUP_ROOT = PROJECT_ROOT / ".hoox-rename-backups"


# ─── Exclusions ────────────────────────────────────────────────────────
EXCLUDE_DIRS = frozenset({
    ".git", "node_modules", ".wrangler", ".next", "dist",
    ".open-next",
    "coverage", ".tmp", ".worktrees", ".ctx", ".husky",
    ".github", ".keys", ".opencode/plugins", ".cache",
    ".hoox-rename-backups", ".wizard-state.json",
    ".opencode/plugins", ".opencode/node_modules",
})

EXCLUDE_FILES_PATTERNS = [
    re.compile(r".*\.lock$"),
    re.compile(r".*\.DS_Store$"),
    re.compile(r".*\.gitkeep$"),
    re.compile(r".*\.gitignore$"),
    re.compile(r".*\.tsbuildinfo$"),
    re.compile(r".*\.lcov\.info.*tmp$"),
]

# File extensions / names to scan
INCLUDE_NAMES = {".env", ".dev.vars", ".env.example", ".dev.vars.example",
                 ".env.local", ".env.local.example"}


# ─── Canonical Exceptions ──────────────────────────────────────────────
# These names are already canonical — never rename them
CANONICAL_EXCEPTIONS = frozenset({
    # CF-specific
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_SECRET_STORE_ID", "SUBDOMAIN_PREFIX",
    # Dashboard auth
    "AGENT_INTERNAL_KEY", "DASHBOARD_USER", "DASHBOARD_PASS",
    "SESSION_SECRET",
    # Telegram
    "TELEGRAM_SECRET_TOKEN",
    # Email
    "MAILGUN_API_KEY", "EMAIL_SCAN_SUBJECT",
    # Wallet
    "WALLET_PK_SECRET", "WALLET_MNEMONIC_SECRET",
    # Report worker
    "CF_API_TOKEN_BINDING", "ACCOUNT_ID",
    # Infra bindings (non-secret)
    "REPORTS_BUCKET", "UPLOADS_BUCKET", "SYSTEM_LOGS_BUCKET",
    "CONFIG_KV", "SESSIONS_KV",
    "BROWSER", "AI", "DB", "ANALYTICS_ENGINE",
    "VECTORIZE_INDEX", "IDEMPOTENCY_STORE",
    "TRADE_QUEUE",
    # Service bindings
    "TRADE_SERVICE", "TELEGRAM_SERVICE", "D1_SERVICE", "AGENT_SERVICE",
    # Already-correct dashboard vars (don't touch without more context)
    "API_SERVICE_KEY", "API_SERVICE_KEY_BINDING",
    "TRADE_INTERNAL_KEY", "TELEGRAM_INTERNAL_KEY",
    # Agent AI keys
    "AGENT_OPENAI_KEY", "AGENT_ANTHROPIC_KEY", "AGENT_GOOGLE_KEY",
    # Telegram
    "ALLOWED_CHAT_IDS",
    # Already correct per-worker names
    "TELEGRAM_INTERNAL_KEY_BINDING",
    "HA_TOKEN_BINDING", "TG_CHAT_ID_BINDING",
    "TRADE_WORKER_NAME", "USE_IMAP",
    "database_name",
})


# ─── Explicit Old→New Mappings ─────────────────────────────────────────
# From audits/secrets-bindings-audit.md Phase 1 + Phase 2
# Exchange name prefixes for _API_KEY → _KEY_BINDING derivation
EXCHANGE_PREFIXES = frozenset({"BINANCE", "MEXC", "BYBIT"})


EXPLICIT_OVERRIDES: dict[str, str] = {
    # C1: d1-worker auth (D1_INTERNAL_KEY → INTERNAL_KEY_BINDING)
    "D1_INTERNAL_KEY": "INTERNAL_KEY_BINDING",

    # C2: trade-worker outbound auth
    # TELEGRAM_INTERNAL_KEY_BINDING is already canonical — no change needed

    # Phase 2 — Naming Standardization
    # Exchange keys (old: _API_KEY / _API_SECRET → _KEY_BINDING / _SECRET_BINDING)
    "BINANCE_API_KEY": "BINANCE_KEY_BINDING",
    "BINANCE_API_SECRET": "BINANCE_SECRET_BINDING",
    "MEXC_API_KEY": "MEXC_KEY_BINDING",
    "MEXC_API_SECRET": "MEXC_SECRET_BINDING",
    "BYBIT_API_KEY": "BYBIT_KEY_BINDING",
    "BYBIT_API_SECRET": "BYBIT_SECRET_BINDING",

    # Telegram (old: TELEGRAM_BOT_TOKEN → TG_BOT_TOKEN_BINDING)
    "TELEGRAM_BOT_TOKEN": "TG_BOT_TOKEN_BINDING",

    # Email secrets (bare → _BINDING)
    "EMAIL_HOST": "EMAIL_HOST_BINDING",
    "EMAIL_USER": "EMAIL_USER_BINDING",
    "EMAIL_PASS": "EMAIL_PASS_BINDING",

    # Hoox gateway old names (from stale .dev.vars.example)
    "INTERNAL_SERVICE_KEY": "INTERNAL_KEY_BINDING",
    "API_SECRET_KEY": "WEBHOOK_API_KEY_BINDING",
    "TRADE_WORKER_URL": "TRADE_SERVICE",
    "TELEGRAM_WORKER_URL": "TELEGRAM_SERVICE",

    # Common bare → _BINDING
    "INTERNAL_KEY": "INTERNAL_KEY_BINDING",
    "WEBHOOK_API_KEY": "WEBHOOK_API_KEY_BINDING",
    "TG_BOT_TOKEN": "TG_BOT_TOKEN_BINDING",

    # Stale .dev.vars.example references
    "D1_WORKER_URL": "D1_SERVICE",
    "TELEGRAM_SERVICE_URL": "TELEGRAM_SERVICE",
}


# ─── Helpers ───────────────────────────────────────────────────────────

def should_include_file(filepath: Path) -> bool:
    """Check if a file should be scanned for renames."""
    # Exclude by directory
    for part in filepath.parts:
        if part in EXCLUDE_DIRS:
            return False
    # Exclude by file pattern
    for pattern in EXCLUDE_FILES_PATTERNS:
        if pattern.match(filepath.name):
            return False
    # Include by name pattern
    name = filepath.name
    if any(n in name for n in INCLUDE_NAMES):
        return True
    # Include by extension
    ext = filepath.suffix.lower()
    if ext in {".jsonc", ".json", ".ts", ".js", ".md", ".yaml", ".yml",
               ".toml", ".sh", ".dockerfile", ".txt", ".cfg", ".conf"}:
        return True
    return False


def _extract_worker_block_names(content: str, start: int) -> dict:
    """Extract names from a single worker block in registry.ts."""
    info = {
        "secrets": set(),
        "plaintext": set(),
        "services": set(),
        "kv": set(),
        "r2": set(),
        "d1": set(),
        "vectorize": set(),
        "durable_objects": set(),
        "queues": set(),
    }

    # Find the closing brace of this worker block
    depth = 0
    end = start
    for i in range(start, len(content)):
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    block = content[start:end]

    # Extract vars — pattern: VAR_NAME: { type: "secret", ...
    for m in re.finditer(
        r'(\w+):\s*\{\s*type:\s*"(secret|plaintext)"', block
    ):
        name = m.group(1)
        var_type = m.group(2)
        if name in ("vars", "path", "name", "services", "infrastructure"):
            continue
        if var_type == "secret":
            info["secrets"].add(name)
        else:
            info["plaintext"].add(name)

    # Extract service binding names
    for m in re.finditer(r'binding:\s*"(\w+)"\s*,\s*service:', block):
        info["services"].add(m.group(1))

    # Extract infra binding names (kv, r2, d1, vectorize)
    for target in ("kv", "r2", "d1", "vectorize"):
        # Find the infrastructure[target] section and extract binding names
        pattern = re.compile(
            r"\b" + re.escape(target) + r"\b\s*:\s*\[(.*?)\]",
            re.DOTALL,
        )
        for match in pattern.finditer(block):
            for bm in re.finditer(r'binding:\s*"(\w+)"', match.group(1)):
                info[target].add(bm.group(1))

    # Durable Objects
    for m in re.finditer(r'name:\s*"(\w+)"\s*,\s*className:', block):
        info["durable_objects"].add(m.group(1))

    return info


def parse_canonical_registry() -> dict:
    """Parse registry.ts to extract all canonical names."""
    content = REGISTRY_PATH.read_text(encoding="utf-8")

    result: dict = {
        "secrets": set(),
        "plaintext": set(),
        "service_bindings": set(),
        "kv": set(),
        "r2": set(),
        "d1": set(),
        "queues": set(),
        "vectorize": set(),
        "durable_objects": set(),
        "per_worker": {},
    }

    # Find the main manifests object
    mm = re.search(r"const manifests:\s*Record<.*?>\s*=\s*{", content)
    if not mm:
        print("❌ Could not find manifests object in registry.ts")
        return result

    # Find each top-level worker block inside manifests
    # Pattern: "worker-name": {   OR   worker-name: {  (unquoted for valid JS identifiers)
    worker_iter = re.finditer(
        r'\n\s*(?:"([^"]+)"|([a-zA-Z]\w*))\s*:\s*\{',
        content[mm.end() :],
    )

    for m in worker_iter:
        worker_name = m.group(1) or m.group(2)  # quoted or unquoted
        # Skip non-worker properties (vars, services, infrastructure, etc.)
        if not worker_name or ("-" not in worker_name
                                and worker_name not in ("hoox", "dashboard")):
            continue
        start_pos = mm.end() + m.start()
        info = _extract_worker_block_names(content, start_pos)

        result["per_worker"][worker_name] = info
        result["secrets"].update(info["secrets"])
        result["plaintext"].update(info["plaintext"])
        result["service_bindings"].update(info["services"])
        result["kv"].update(info["kv"])
        result["r2"].update(info["r2"])
        result["d1"].update(info["d1"])
        result["vectorize"].update(info["vectorize"])
        result["durable_objects"].update(info["durable_objects"])

    # Also find queues from content
    for m in re.finditer(
        r'queues\s*:\s*\{\s*(?:producer|consumer)\s*:\s*\[([^\]]*)\]', content
    ):
        for q in re.finditer(r'"([^"]+)"', m.group(1)):
            result["queues"].add(q.group(1))

    return result


def build_rename_map(canonical: dict) -> dict[str, str]:
    """
    Build old_name → canonical_name mapping.

    Sources (in priority order):
      1. Explicit overrides from the audit
      2. Heuristic: for canonical _BINDING names, derive old names
         (strip suffix, try _API_KEY, etc.)
      3. Heuristic: for canonical _SECRET names, derive old names
    """
    rename_map: dict[str, str] = {}

    # 1. Start with explicit overrides
    for old, new in EXPLICIT_OVERRIDES.items():
        # Verify the target is canonical or skip
        if new in canonical["secrets"] or new in canonical["service_bindings"] \
           or new in canonical["kv"] or new in canonical["r2"] \
           or new in canonical["d1"] or new in canonical["service_bindings"] \
           or new in canonical["queues"]:
            rename_map[old] = new
        else:
            # Target isn't in canonical schema — still include as a warning
            # but don't add to rename map automatically
            pass

    # 2. Derive old names from canonical secret names
    for secret in sorted(canonical["secrets"], key=len, reverse=True):
        if secret in CANONICAL_EXCEPTIONS:
            continue

        # For _BINDING names, derive old variants
        if secret.endswith("_BINDING"):
            base = secret[:-8]  # remove _BINDING

            # Old: bare base (e.g., INTERNAL_KEY_BINDING → INTERNAL_KEY)
            if (base not in canonical["secrets"]
                    and base not in CANONICAL_EXCEPTIONS
                    and base not in rename_map):
                rename_map[base] = secret

            # Old: _API_KEY instead of _KEY_BINDING (exchange keys only)
            if base.endswith("_KEY") and any(
                base.startswith(p) for p in EXCHANGE_PREFIXES
            ):
                api_old = base[:-4] + "_API_KEY"
                if (api_old not in canonical["secrets"]
                        and api_old not in CANONICAL_EXCEPTIONS
                        and api_old not in rename_map):
                    rename_map[api_old] = secret

            # Old: _API_SECRET instead of _SECRET_BINDING (exchange keys only)
            if base.endswith("_SECRET") and any(
                base.startswith(p) for p in EXCHANGE_PREFIXES
            ):
                api_old = base[:-7] + "_API_SECRET"
                if (api_old not in canonical["secrets"]
                        and api_old not in CANONICAL_EXCEPTIONS
                        and api_old not in rename_map):
                    rename_map[api_old] = secret

        # For _SECRET names, derive old bare variants
        elif secret.endswith("_SECRET"):
            base = secret[:-7]
            if (base not in canonical["secrets"]
                    and base not in CANONICAL_EXCEPTIONS
                    and base not in rename_map):
                rename_map[base] = secret

        # For names with INTERNAL_KEY, add D1_INTERNAL_KEY variant
        # (already handled by explicit overrides)

    return rename_map


def scan_file_for_names(filepath: Path, rename_map: dict[str, str]
                        ) -> list[tuple[str, str, int]]:
    """
    Scan a single file for old names.
    Returns list of (old_name, new_name, line_number).
    """
    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except (UnicodeDecodeError, PermissionError, OSError):
        return []

    matches: list[tuple[str, str, int]] = []
    lines = content.split("\n")

    # Sort old names by length (longest first) to avoid partial matches
    old_names = sorted(rename_map.keys(), key=len, reverse=True)

    # Build regex patterns — compile once for performance
    patterns = {
        name: re.compile(r"\b" + re.escape(name) + r"\b")
        for name in old_names
    }

    for line_no, line in enumerate(lines, 1):
        for old_name in old_names:
            if patterns[old_name].search(line):
                matches.append((old_name, rename_map[old_name], line_no))
                break  # One match per line to avoid double-counting

    return matches


def apply_renames_to_file(filepath: Path, rename_map: dict[str, str],
                          backup: bool = False) -> list[tuple[str, str, int]]:
    """
    Apply renames to a file. Returns list of (old_name, new_name, line_number).
    """
    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except (UnicodeDecodeError, PermissionError, OSError):
        return []

    # Create backup
    if backup:
        rel = filepath.relative_to(PROJECT_ROOT)
        backup_dir = BACKUP_ROOT / rel.parent
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(filepath, backup_dir / rel.name)

    lines = content.split("\n")
    replacements: list[tuple[str, str, int]] = []
    new_lines: list[str] = []

    # Sort old names by length descending
    old_names = sorted(rename_map.keys(), key=len, reverse=True)
    patterns = {
        name: re.compile(r"\b" + re.escape(name) + r"\b")
        for name in old_names
    }

    for line_no, line in enumerate(lines, 1):
        new_line = line
        line_has_replacements = False

        for old_name in old_names:
            new_name = rename_map[old_name]
            new_line, count = patterns[old_name].subn(new_name, new_line)
            if count > 0:
                replacements.append((old_name, new_name, line_no))
                line_has_replacements = True
                # Continue to check next patterns on same line

        new_lines.append(new_line)

    if replacements:
        filepath.write_text("\n".join(new_lines), encoding="utf-8")

    return replacements


def print_report(results: dict, is_dry_run: bool):
    """Print scan/replace results."""
    mode = "DRY RUN" if is_dry_run else "APPLIED"

    total_files = results.get("_files_scanned", 0)
    files_with_changes = sum(
        1 for k, v in results.items()
        if not k.startswith("_") and v["replacements"]
    )
    total_replacements = sum(
        len(v["replacements"]) for k, v in results.items()
        if not k.startswith("_")
    )

    print()
    print("=" * 70)
    print(f"  {mode}")
    print("=" * 70)
    print(f"  Schema source: {REGISTRY_PATH.relative_to(PROJECT_ROOT)}")
    print(f"  Files scanned:  {total_files}")
    print(f"  Files changed:  {files_with_changes}")
    print(f"  Replacements:   {total_replacements}")

    if not is_dry_run:
        backup_msg = (
            f" (backups in {BACKUP_ROOT})"
            if BACKUP_ROOT.exists() and any(BACKUP_ROOT.iterdir())
            else ""
        )
        print(f"  Mode: --apply{backup_msg}")

    if total_replacements == 0:
        print()
        print("  ✅ No old names found. All names match the canonical schema.")
        return

    print()
    print("─" * 70)
    print("  CHANGES BY FILE:")
    print("─" * 70)

    for filepath, info in sorted(results.items()):
        if filepath.startswith("_"):
            continue
        if not info["replacements"]:
            continue
        print(f"\n  📄 {filepath}:")

        # Group by name for cleaner output
        by_old: dict[str, list[int]] = {}
        for old_name, new_name, line_no in info["replacements"]:
            key = f"    {old_name} → {new_name}"
            if key not in by_old:
                by_old[key] = []
            by_old[key].append(line_no)

        for rename, lines in by_old.items():
            if len(lines) <= 3:
                line_str = ", ".join(f"L{n}" for n in lines)
            else:
                line_str = f"L{lines[0]}–L{lines[-1]} ({len(lines)} occurrences)"
            print(f"  {rename}  [{line_str}]")

    if is_dry_run:
        print()
        print("  💡 Run with --apply to apply these changes.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rename old secrets/KV bindings to canonical names",
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Apply changes (default is dry-run)",
    )
    parser.add_argument(
        "--backup", action="store_true",
        help="Create backup files before modifying",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Verbose output (show all canonical names, rename map)",
    )
    args = parser.parse_args()

    # ── Step 1: Parse canonical schema ──
    print("📖 Reading canonical schema from registry.ts...", end=" ")
    if not REGISTRY_PATH.exists():
        print(f"\n❌ Error: {REGISTRY_PATH} not found!")
        return 1

    canonical = parse_canonical_registry()
    print("OK")
    print(
        f"   Secrets: {len(canonical['secrets'])}  "
        f"Plaintext: {len(canonical['plaintext'])}  "
        f"Service bindings: {len(canonical['service_bindings'])}  "
        f"KV: {len(canonical['kv'])}  R2: {len(canonical['r2'])}  "
        f"D1: {len(canonical['d1'])}"
    )
    print(f"   Workers in manifest: {', '.join(sorted(canonical['per_worker'].keys()))}")

    if args.verbose:
        print(f"\n   Canonical secrets:")
        for name in sorted(canonical["secrets"]):
            print(f"     {name}")
        print(f"\n   Service bindings: {sorted(canonical['service_bindings'])}")
        print(f"   KV: {sorted(canonical['kv'])}")
        print(f"   R2: {sorted(canonical['r2'])}")
        print(f"   D1: {sorted(canonical['d1'])}")

    # ── Step 2: Build rename map ──
    rename_map = build_rename_map(canonical)

    if not rename_map:
        print("\n❌ No rename mappings could be derived from the schema.")
        print("   Check that the registry.ts file has valid worker definitions.")
        return 1

    if args.verbose:
        print(f"\n📋 Rename map ({len(rename_map)} entries):")
        for old, new in sorted(rename_map.items(),
                                key=lambda x: (-len(x[0]), x[0])):
            print(f"   {old:40s} → {new}")

    # ── Step 3: Scan files ──
    print(f"\n🔍 Scanning project files for old names...")

    files_scanned = 0
    results: dict = {"_files_scanned": 0}

    for filepath in sorted(PROJECT_ROOT.rglob("*")):
        if not filepath.is_file():
            continue
        if not should_include_file(filepath):
            continue

        files_scanned += 1

        if args.apply:
            rep = apply_renames_to_file(filepath, rename_map, backup=args.backup)
        else:
            rep = scan_file_for_names(filepath, rename_map)

        if rep:
            rel = str(filepath.relative_to(PROJECT_ROOT))
            results[rel] = {"replacements": rep}

            if args.verbose:
                print(f"   {rel} — {len(rep)} match(es)")

    results["_files_scanned"] = files_scanned

    # ── Step 4: Print report ──
    print_report(results, is_dry_run=not args.apply)

    if not args.apply and results["_files_scanned"] > 0:
        # Check if any replacements found
        has_changes = any(
            v["replacements"] for k, v in results.items()
            if not k.startswith("_")
        )
        if has_changes:
            return 1  # Mismatches found

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
