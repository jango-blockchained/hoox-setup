# TUI CLI Bridge Design

**Date:** 2026-05-17
**Status:** Draft
**Author:** Development Agent

## 1. Problem Statement

The TUI (`packages/tui/`) has 9 interactive views, but most action buttons and operations are stubs that don't actually execute work. The CLI (`packages/cli/`) has 18 top-level commands with 60+ subcommands covering deploy, config, monitoring, infra management, and system checks — all inaccessible from the TUI.

Users must context-switch between the TUI dashboard and a shell to perform operations, defeating the purpose of an operations center.

## 2. Design Constraints

- **No CLI refactoring** — CLI code uses Commander.js, `ansis`, `@clack/prompts`, and process-level error handling. Importing into TUI would conflict with OpenTUI's render loop and React lifecycle.
- **No shared package extraction** — Too large a refactoring for this pass. Services are tightly coupled to CLI-specific utilities (formatters, theme, errors).
- **Established pattern** — SetupWizard already uses `Bun.spawn` for system checks (`spawnVersion` in line 39-52 of `setup-wizard.tsx`). Extend this pattern.
- **Performance** — Commands must not block the TUI render loop (30 FPS target). Use async `Bun.spawn` with streaming output.
- **Structured output** — CLI already supports `--json` flag via formatters. Use it for machine-parseable results.

## 3. Architecture: CLI Bridge

### 3.1 Core Module

New file: `packages/tui/src/services/cli-bridge.ts`

```typescript
// CliBridge — spawns hoox CLI as subprocess, captures structured output
// Uses --json flag for parseable results, streams stderr for progress

interface CliResult<T = unknown> {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data: T | null; // parsed JSON from --json output
  duration: number; // execution time in ms
}

type CommandSpec = {
  args: string[];
  json?: boolean;
  timeout?: number; // default 30s, deploy 120s
  description?: string; // human-readable label for progress display
};

class CliBridge {
  private hooxPath: string; // resolved path to hoox binary
  private running: Map<string, AbortController>; // track in-flight commands

  constructor();
  async resolveBinary(): Promise<string>; // find hoox on PATH or monorepo
  async exec<T>(spec: CommandSpec): Promise<CliResult<T>>;
  abort(tag: string): void; // cancel running command
  dispose(): void; // abort all on unmount
}
```

### 3.2 Binary Resolution Strategy

```
1. Check PATH for `hoox` (global install via `bun link` or npm)
2. Fallback: `bun run <monorepo-root>/packages/cli/src/index.ts` (dev mode)
3. For `wrangler` subprocesses, rely on CLI package's own resolution
```

Resolution happens once at TUI startup and is cached.

### 3.3 Streaming Output

For long-running commands (`deploy`, `monitor`), the bridge streams stderr line-by-line to a progress callback. This enables the TUI to show a live progress indicator (e.g., "DEPLOYING WORKER trade-worker... ⏳") instead of a frozen spinner.

```typescript
type ProgressCallback = (line: string) => void;

async exec<T>(
  spec: CommandSpec,
  onProgress?: ProgressCallback
): Promise<CliResult<T>>
```

### 3.4 Error Handling

| Scenario                       | Behavior                                         |
| ------------------------------ | ------------------------------------------------ |
| Command not found              | Binary resolution failed → show install prompt   |
| Timeout                        | AbortController fires → show "Command timed out" |
| Non-zero exit code             | Show stderr + exit code in error panel           |
| JSON parse failure             | Fall back to raw stdout display                  |
| Network error (Cloudflare API) | Show "API unreachable" with retry option         |

Errors are surfaced via `useServiceStore.getState().addAlert()` so they appear in the Dashboard alerts panel and StatusBar.

## 4. Per-View Integration Map

### 4.1 ServiceManager (highest priority)

| UI Element           | Current    | Target CLI Command                 |
| -------------------- | ---------- | ---------------------------------- |
| [Deploy All]         | no-op stub | `hoox deploy all --json`           |
| [Restart All]        | no-op stub | `hoox repair rebuild --json`       |
| Per-worker [Deploy]  | no-op stub | `hoox deploy worker <name> --json` |
| Per-worker [Restart] | no-op stub | `hoox repair worker <name> --json` |

**UX**: On click, show deploy progress (stderr forwarded as status lines). On success, refresh worker list via `serviceStore.fetchWorkers()`. On failure, show error in alert panel.

### 4.2 Dashboard

| UI Element  | Current          | Target CLI Command           |
| ----------- | ---------------- | ---------------------------- |
| Health grid | static/demo data | `hoox check health --json`   |
| Refresh     | no-op            | `hoox monitor status --json` |

**UX**: Dashboard polls `check health` on mount. Replace mock data with real response. Add a refresh action.

### 4.3 WorkersOverview

| UI Element          | Current | Target CLI Command                 |
| ------------------- | ------- | ---------------------------------- |
| Card action buttons | no-op   | `hoox deploy worker <name> --json` |

### 4.4 WorkerDetail

| UI Element     | Current       | Target CLI Command               |
| -------------- | ------------- | -------------------------------- |
| Live Logs pane | mock/filtered | `hoox logs worker <name> --json` |
| Config Preview | static        | `hoox config show --json`        |

### 4.5 LogsViewer

| UI Element      | Current         | Target CLI Command                                                    |
| --------------- | --------------- | --------------------------------------------------------------------- |
| [Export]        | `// TODO`       | Write current filtered logs to `~/.hoox/logs-export-<timestamp>.json` |
| [Clear]         | `// TODO`       | Local store clear + optionally `hoox monitor logs --clear`            |
| Log data source | SSE stream only | Fallback: `hoox logs all --json` if SSE unavailable                   |

### 4.6 ConfigEditor

| UI Element | Current          | Target CLI Command                                                       |
| ---------- | ---------------- | ------------------------------------------------------------------------ |
| [Save]     | Writes file only | On save, call `hoox config env validate --json` + show validation errors |

### 4.7 SetupWizard — Step 6 (Deploy)

| UI Element   | Current                   | Target CLI Command                                      |
| ------------ | ------------------------- | ------------------------------------------------------- |
| [Deploy Now] | Writes config + navigates | Write config + `hoox deploy all --json` + show progress |

### 4.8 Settings

| UI Element  | Current   | Target CLI Command                          |
| ----------- | --------- | ------------------------------------------- |
| Clear Cache | `// TODO` | `rm -rf ~/.hoox/cache`                      |
| Export Data | `// TODO` | `hoox config show --json` → write file      |
| Import Data | `// TODO` | Read file → `hoox config set` batched calls |
| Setup Check | none      | `hoox check setup --json` → show results    |

## 5. New TUI Types

Add to `packages/tui/src/types.ts`:

```typescript
// CLI bridge
interface CliResult<T = unknown> {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data: T | null;
  duration: number;
}

type CliCommandStatus = "idle" | "running" | "success" | "failure";

interface CliCommandState {
  tag: string;
  description: string;
  status: CliCommandStatus;
  result: CliResult | null;
  startedAt: number | null;
}
```

## 6. Dependency Changes

**`packages/tui/package.json`**: No new dependencies. `Bun.spawn` is native Bun API.

**Binary resolution**: The TUI needs to know where the monorepo root is. On launch, it can resolve via `import.meta.dir` or `process.cwd()`. Since the TUI is typically launched from repo root (`hoox tui` or `bun run packages/tui/`), `process.cwd()` pointing to the monorepo root is the default assumption.

## 7. Testing Strategy

| Test Level  | Scope                            | Method                                                        |
| ----------- | -------------------------------- | ------------------------------------------------------------- |
| Unit        | `CliBridge.exec()` parsing logic | Mock `Bun.spawn`, test timeout/error/json parsing             |
| Unit        | Per-view integration hooks       | Test that button click calls correct bridge method            |
| Integration | End-to-end with real CLI         | Test that `hoox check health --json` returns parseable output |
| Manual      | Visual verification              | Launch TUI, click Deploy, confirm progress shown              |

## 8. Implementation Order

1. Core `CliBridge` class (binary resolution, `exec()`, timeout, JSON parsing)
2. `ServiceManager` — Deploy All + per-worker deploy/restart
3. `Dashboard` — Health check integration
4. `WorkersOverview` — Per-worker action buttons
5. `WorkerDetail` — Live logs + config integration
6. `LogsViewer` — Export + Clear
7. `SetupWizard` — Deploy step (was partially done, finalize)
8. `Settings` — Cache/export/import
9. `ConfigEditor` — Validate-on-save

## 9. Future Considerations

- **Terminal view**: After all views are wired, consider a dedicated "Terminal" view for ad-hoc CLI commands (like VSCode integrated terminal). This is explicitly out of scope for this design.
- **Shared service extraction**: If CLI and TUI converge on a shared service layer in the future, the bridge can be replaced with direct imports without changing view code (the bridge is an adapter).
- **WebSocket command streaming**: For very long-running operations, consider wrapping CLI commands in a WebSocket service that streams progress. Not needed for current command set.
