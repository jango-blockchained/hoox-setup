# Changelog

All notable changes to `@jango-blockchained/hoox-cli` are documented here.
This project adheres loosely to [Semantic Versioning](https://semver.org/).

## [0.9.1] — 2026-06-25

### Fixed

- **Banner version lookup broken in global install**: `ui/banner.ts` used a relative path (`../../package.json`) that works from source but not from the bundled `dist/index.js` in a globally-installed package. When the user ran `hoox` with no args, the banner tried to read `/path/to/install/@jango-blockchained/package.json` (which doesn't exist) and threw `ENOENT`. The fix walks up from `import.meta.url` looking for the hoox-cli `package.json` by name, working in both layouts.

## [0.9.0] — 2026-06-24

### Added

- **New `--no-color` global flag** to disable all ANSI color output (alongside `--json` and `--quiet`).
- **`NO_COLOR` env var honored** (https://no-color.org standard).
- **`formatCompletion(message, { durationMs, suggestion })`** — new formatter that prints a "✓ Done in 1.2s" footer with an optional "→ next: hoox …" suggestion. Wired into the global `program` postAction hook.
- **"Did you mean …" suggestions** for unknown commands via Levenshtein distance. A typo like `hoox deplpy` now suggests `hoox deploy`.
- **Custom help formatter** — `hoox --help` and per-command `--help` render with sectioned layout (Usage / Options / Examples / See also) and refined colors.
- **`formatNumber(n)`** — compact notation (1.2K, 1.5M, 2.5B) used by `formatTable` number auto-alignment and by perf/monitor/trace.
- **`formatBytes(n, { binary? })`** — SI (KB/MB) or binary (KiB/MiB).

### Changed

- **Theme palette refined** to a modern-minimal aesthetic (zinc/slate base, single indigo-400 accent, de-saturated status colors). Visual change ripples through every command; information content unchanged.
- **Badge style** — `formatBadge()` no longer uses high-contrast background chips; now renders colored glyph + colored text (Vercel / Linear style).
- **Spinner** — uses braille dots (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) instead of plain ASCII.
- **`formatTable` options** — now supports `zebra`, `alignNumbers`, `colorizeStatus`, `compact` (all default to on, except `compact` which defaults to off). Backward compatible.
- **`formatError` options** — now accepts `suggestions: string[]` and `inCard: boolean`. JSON output includes a new `suggestions` field.
- **Banner default** — now `minimal` (was `legacy`).

### Fixed

- **Banner version drift**: `ui/banner.ts` was hardcoded to `v0.3.0` while the package was at `v0.8.0`. Now reads dynamically from `package.json`.
