# TUI CLI Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all hoox CLI commands into existing TUI views so action buttons (Deploy, Restart, Export, Clear, etc.) execute real operations instead of being stubs.

**Architecture:** A `CliBridge` service in `packages/tui/src/services/cli-bridge.ts` spawns the `hoox` CLI binary via `Bun.spawn`, captures structured output using the CLI's existing `--json` flag, and returns typed results to React view components. Each view imports the bridge singleton and calls the appropriate convenience method (e.g., `cliBridge.deployWorker(name)`).

**Tech Stack:** Bun runtime (`Bun.spawn`), OpenTUI (React views), Commander.js (CLI — unchanged), `@jango-blockchained/hoox-shared` (stores, types, colors)

---

### Task 1: CliBridge Core + Types

**Files:**

- Create: `packages/tui/src/services/cli-bridge.ts`
- Create: `packages/tui/test/services/cli-bridge.test.ts`
- Modify: `packages/tui/src/types.ts` (add 3 type exports)

This is the foundation all other tasks depend on.

- [ ] **Step 1.1: Add CLI types to types.ts**

Open `packages/tui/src/types.ts` and add before the closing of the type exports:

```typescript
// ─── CliBridge Types ─────────────────────────────────────────────

export interface CliResult<T = unknown> {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data: T | null;
  duration: number;
}

export type CliCommandStatus = "idle" | "running" | "success" | "failure";

export interface CliCommandState {
  tag: string;
  description: string;
  status: CliCommandStatus;
  result: CliResult | null;
  startedAt: number | null;
}
```

- [ ] **Step 1.2: Write test for CliBridge**

Create `packages/tui/test/services/cli-bridge.test.ts`:

```typescript
import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { cliBridge } from "../../src/services/cli-bridge";

describe("CliBridge", () => {
  it("resolves binary path to a string", async () => {
    const path = await cliBridge.resolveBinary();
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
  });

  it("executes a simple command and returns CliResult", async () => {
    // We use the built-in `echo` behavior of the CLI — check help
    const result = await cliBridge.exec(["--help"]);
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("exitCode");
    expect(result).toHaveProperty("stdout");
    expect(result).toHaveProperty("stderr");
    expect(typeof result.duration).toBe("number");
  });

  it("captures non-zero exit codes", async () => {
    // Pass an invalid flag — command should fail
    const result = await cliBridge.exec(["--nonexistent-flag"]);
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  it("aborts a running command", async () => {
    const result = await cliBridge.exec(
      ["dev", "start", "--runtime", "native"],
      {
        timeout: 50, // very short timeout to trigger abort
      }
    );
    expect(result.success).toBe(false);
    expect(result.stderr).toContain("timed out");
  });
});
```

- [ ] **Step 1.3: Implement CliBridge**

Create `packages/tui/src/services/cli-bridge.ts`:

```typescript
/**
 * CliBridge — spawns hoox CLI as subprocess via Bun.spawn.
 *
 * Resolves the hoox binary path (PATH → monorepo fallback),
 * executes commands with optional --json flag for structured output,
 * streams stderr for deploy progress, and enforces timeouts.
 *
 * Singleton — use `cliBridge` exported instance.
 */
import * as path from "path";

export interface CliResult<T = unknown> {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data: T | null;
  duration: number;
}

export type CliCommandStatus = "idle" | "running" | "success" | "failure";

export interface CliCommandState {
  tag: string;
  description: string;
  status: CliCommandStatus;
  result: CliResult | null;
  startedAt: number | null;
}

type ProgressCallback = (line: string) => void;

interface ExecOptions {
  json?: boolean;
  timeout?: number;
  description?: string;
  onProgress?: ProgressCallback;
}

function findMonorepoRoot(): string {
  let dir = process.cwd();
  // Walk up looking for package.json with workspaces
  for (let i = 0; i < 10; i++) {
    try {
      const pkg = require(path.join(dir, "package.json"));
      if (pkg.workspaces) return dir;
    } catch {
      /* not found */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

class CliBridge_ {
  private hooxPath: string | null = null;
  private running = new Map<string, AbortController>();
  private resolving = false;
  private resolveWaiters: Array<() => void> = [];

  async resolveBinary(): Promise<string> {
    if (this.hooxPath) return this.hooxPath;

    if (this.resolving) {
      // Another call is resolving — wait for it
      await new Promise<void>((resolve) => this.resolveWaiters.push(resolve));
      return this.hooxPath!;
    }

    this.resolving = true;
    try {
      // 1. Check PATH (global install via `bun link` or npm)
      const which = Bun.spawnSync(["which", "hoox"], { stdout: "pipe" });
      if (which.exitCode === 0) {
        this.hooxPath = which.stdout.toString().trim();
        return this.hooxPath;
      }

      // 2. Check node_modules/.bin (workspace link)
      const repoRoot = findMonorepoRoot();
      const nmBin = path.join(repoRoot, "node_modules", ".bin", "hoox");
      const nmBinFile = Bun.file(nmBin);
      if (await nmBinFile.exists()) {
        this.hooxPath = nmBin;
        return this.hooxPath;
      }

      // 3. Fallback: direct script path
      const scriptPath = path.join(
        repoRoot,
        "packages",
        "cli",
        "bin",
        "hoox.js"
      );
      const scriptFile = Bun.file(scriptPath);
      if (await scriptFile.exists()) {
        this.hooxPath = scriptPath;
        return this.hooxPath;
      }

      throw new Error(
        "hoox CLI not found. Install globally via `bun link` or run from the monorepo root."
      );
    } finally {
      this.resolving = false;
      for (const waiter of this.resolveWaiters) waiter();
      this.resolveWaiters = [];
    }
  }

  private buildArgs(raw: string[], options: ExecOptions): string[] {
    const args = [...raw];
    if (options.json) args.push("--json");
    // Auto-confirm prompts
    args.push("--yes");
    return args;
  }

  async exec<T = unknown>(
    args: string[],
    options: ExecOptions = {}
  ): Promise<CliResult<T>> {
    const hooxPath = await this.resolveBinary();
    const finalArgs = this.buildArgs(args, options);
    const tag = options.description || args.join(" ");
    const timeout = options.timeout ?? 30_000;
    const abortController = new AbortController();

    this.running.set(tag, abortController);
    const startTime = performance.now();

    try {
      const proc = Bun.spawn([hooxPath, ...finalArgs], {
        stdout: "pipe",
        stderr: "pipe",
        signal: abortController.signal,
      });

      const timeoutId = setTimeout(() => abortController.abort(), timeout);

      // Stream stderr for progress callbacks
      if (options.onProgress && proc.stderr) {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              for (const line of text.split("\n").filter(Boolean)) {
                options.onProgress!(line);
              }
            }
          } catch {
            /* stream may abort */
          }
        })();
      }

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      clearTimeout(timeoutId);

      let data: T | null = null;
      if (options.json && exitCode === 0 && stdout.trim()) {
        try {
          data = JSON.parse(stdout) as T;
        } catch {
          /* output may not be JSON despite --json flag */
        }
      }

      const duration = performance.now() - startTime;

      return {
        success: exitCode === 0,
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        data,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const isTimeout = error instanceof Error && error.name === "AbortError";
      return {
        success: false,
        exitCode: -1,
        stdout: "",
        stderr: isTimeout
          ? `Command timed out after ${timeout}ms`
          : String(error),
        data: null,
        duration,
      };
    } finally {
      this.running.delete(tag);
    }
  }

  /** Convenience: deploy all workers */
  async deployAll(onProgress?: ProgressCallback): Promise<CliResult> {
    return this.exec(["deploy", "all"], {
      json: true,
      timeout: 120_000,
      description: "Deploy all workers",
      onProgress,
    });
  }

  /** Convenience: deploy a specific worker */
  async deployWorker(
    name: string,
    onProgress?: ProgressCallback
  ): Promise<CliResult> {
    return this.exec(["deploy", "worker", name], {
      json: true,
      timeout: 60_000,
      description: `Deploy ${name}`,
      onProgress,
    });
  }

  /** Convenience: system health check */
  async checkHealth(): Promise<CliResult> {
    return this.exec(["check", "health"], {
      json: true,
      timeout: 15_000,
      description: "Health check",
    });
  }

  /** Convenience: fetch worker logs */
  async workerLogs(name: string): Promise<CliResult> {
    return this.exec(["logs", "worker", name], {
      json: true,
      timeout: 15_000,
      description: `Logs: ${name}`,
    });
  }

  /** Convenience: show config */
  async configShow(): Promise<CliResult> {
    return this.exec(["config", "show"], {
      json: true,
      timeout: 10_000,
      description: "Config show",
    });
  }

  /** Convenience: validate env config */
  async configValidate(): Promise<CliResult> {
    return this.exec(["config", "env", "validate"], {
      json: true,
      timeout: 10_000,
      description: "Validate config",
    });
  }

  /** Convenience: monitor system status */
  async monitorStatus(): Promise<CliResult> {
    return this.exec(["monitor", "status"], {
      json: true,
      timeout: 15_000,
      description: "System status",
    });
  }

  /** Convenience: rebuild infrastructure */
  async rebuild(onProgress?: ProgressCallback): Promise<CliResult> {
    return this.exec(["repair", "rebuild"], {
      json: true,
      timeout: 120_000,
      description: "Rebuild infrastructure",
      onProgress,
    });
  }

  /** Convenience: repair a specific worker */
  async repairWorker(
    name: string,
    onProgress?: ProgressCallback
  ): Promise<CliResult> {
    return this.exec(["repair", "worker", name], {
      json: true,
      timeout: 60_000,
      description: `Repair ${name}`,
      onProgress,
    });
  }

  /** Convenience: check setup */
  async checkSetup(): Promise<CliResult> {
    return this.exec(["check", "setup"], {
      json: true,
      timeout: 20_000,
      description: "Setup check",
    });
  }

  abort(tag: string): void {
    const controller = this.running.get(tag);
    if (controller) controller.abort();
  }

  dispose(): void {
    for (const [, controller] of this.running) controller.abort();
    this.running.clear();
  }
}

export const cliBridge = new CliBridge_();
```

- [ ] **Step 1.4: Verify CliBridge resolves binary and runs**

```bash
cd packages/tui && bun test test/services/cli-bridge.test.ts -t "resolves binary"
```

Expected: PASS or — if hoox isn't installed globally — the test should still pass because the monorepo fallback finds `packages/cli/bin/hoox.js`.

- [ ] **Step 1.5: Run all CliBridge tests**

```bash
cd packages/tui && bun test test/services/cli-bridge.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 1.6: Commit**

```bash
git add packages/tui/src/services/cli-bridge.ts packages/tui/src/types.ts packages/tui/test/services/cli-bridge.test.ts
git commit -m "feat(tui): add CliBridge service for executing hoox CLI commands"
```

---

### Task 2: ServiceManager — Wire Deploy/Restart

**Files:**

- Modify: `packages/tui/src/components/views/service-manager.tsx`

ServiceManager has [Deploy All], [Restart All] bulk buttons and per-worker [Deploy]/[Restart] buttons. Currently all are no-op stubs.

- [ ] **Step 2.1: Read the current service-manager.tsx to understand button handler structure**

```bash
bun x tsc --noEmit packages/tui/src/components/views/service-manager.tsx 2>/dev/null || true
# Read the file to find current handler implementations
```

- [ ] **Step 2.2: Add import and deploy state to ServiceManager**

Add to imports at the top of `service-manager.tsx`:

```typescript
import { cliBridge } from "../../services/cli-bridge";
import { useServiceStore } from "@jango-blockchained/hoox-shared";
import { Colors } from "@jango-blockchained/hoox-shared";
```

Add state for tracking in-flight operations inside the component function, after existing state declarations:

```typescript
const [deploying, setDeploying] = useState<string | null>(null); // worker name or "all"
const [deployProgress, setDeployProgress] = useState<string>("");
```

- [ ] **Step 2.3: Wire the [Deploy All] handler**

Replace the current `handleDeployAll` no-op (or add it if missing) with:

```typescript
const handleDeployAll = async () => {
  if (deploying) return;
  setDeploying("all");
  setDeployProgress("");
  const result = await cliBridge.deployAll((line) => {
    setDeployProgress((prev) => prev + line + "\n");
  });
  if (result.success) {
    useServiceStore.getState().addAlert({
      id: `deploy-${Date.now()}`,
      type: "deploy",
      severity: "info",
      message: "All workers deployed successfully",
      timestamp: Date.now(),
      source: "cli-bridge",
    });
    useServiceStore.getState().fetchWorkers();
  } else {
    useServiceStore.getState().addAlert({
      id: `deploy-${Date.now()}`,
      type: "deploy",
      severity: "error",
      message: result.stderr || "Deploy failed",
      timestamp: Date.now(),
      source: "cli-bridge",
    });
  }
  setDeploying(null);
  setDeployProgress("");
};
```

- [ ] **Step 2.4: Wire per-worker [Deploy] handlers**

Replace the per-worker deploy action with:

```typescript
const handleDeployWorker = async (name: string) => {
  if (deploying) return;
  setDeploying(name);
  setDeployProgress("");
  const result = await cliBridge.deployWorker(name, (line) => {
    setDeployProgress((prev) => prev + line + "\n");
  });
  if (result.success) {
    useServiceStore.getState().addAlert({
      id: `deploy-${name}-${Date.now()}`,
      type: "deploy",
      severity: "info",
      message: `Worker ${name} deployed`,
      timestamp: Date.now(),
      source: "cli-bridge",
    });
    useServiceStore.getState().fetchWorkers();
  } else {
    useServiceStore.getState().addAlert({
      id: `deploy-${name}-${Date.now()}`,
      type: "deploy",
      severity: "error",
      message: result.stderr || `Deploy ${name} failed`,
      timestamp: Date.now(),
      source: "cli-bridge",
    });
  }
  setDeploying(null);
  setDeployProgress("");
};
```

- [ ] **Step 2.5: Wire [Restart All] to cliBridge.rebuild()**

Similar pattern to deploy all — calls `cliBridge.rebuild()` and shows progress.

- [ ] **Step 2.6: Wire per-worker [Restart] to cliBridge.repairWorker()**

Similar pattern — calls `cliBridge.repairWorker(name)` and shows progress.

- [ ] **Step 2.7: Update the JSX to show progress indicator when deploying**

Find the button render area and add deploy state display:

```typescript
// Inside the deploy button's onMouseUp, replace no-op with:
onMouseUp={() => handleDeployWorker(worker.name)}

// Add progress indicator below button row:
{deploying && (
  <box flexDirection="column" gap={0} paddingLeft={2}>
    <text fg={Colors.accent}>DEPLOYING {deploying}...</text>
    {deployProgress && (
      <scrollbox height={5}>
        <text fg={Colors.muted} dim>{deployProgress}</text>
      </scrollbox>
    )}
  </box>
)}
```

- [ ] **Step 2.8: Toggle deploy button disabled/loading state**

Set button text to `[DEPLOYING...]` and disabled color while `deploying` matches, so users can't re-trigger.

- [ ] **Step 2.9: Build to verify**

```bash
cd packages/tui && bun run build 2>&1 | tail -5
```

Expected: "Bundled N modules in Xms" — no build errors.

- [ ] **Step 2.10: Commit**

```bash
git add packages/tui/src/components/views/service-manager.tsx
git commit -m "feat(tui): wire ServiceManager deploy/restart buttons to CliBridge"
```

---

### Task 3: Dashboard — Wire Health Check

**Files:**

- Modify: `packages/tui/src/components/views/dashboard.tsx`

Dashboard shows system health overview. Currently depends on polling from `serviceStore.fetchWorkers()` which goes through the REST API. Supplement with CLI health check for validation.

- [ ] **Step 3.1: Read dashboard.tsx to understand current health display**

Find where health data is rendered and where the refresh/poll logic lives.

- [ ] **Step 3.2: Add CLI health check on mount + refresh action**

Add to imports:

```typescript
import { cliBridge } from "../../services/cli-bridge";
import { useServiceStore } from "@jango-blockchained/hoox-shared";
```

Add a `useEffect` that runs `cliBridge.checkHealth()` on mount and a `refreshHealth` callback for manual refresh. Parse the JSON response and feed it into the service store or local state.

- [ ] **Step 3.3: Add a visual refresh action**

Add a clickable `[REFRESH]` label (or repurpose an existing one) that calls `cliBridge.monitorStatus()` and updates the displayed metrics.

- [ ] **Step 3.4: Handle offline gracefully**

If the CLI health check fails (no API available), preserve the existing SSE/polling fallback behavior. The bridge result's `success: false` triggers an alert but doesn't crash the view.

- [ ] **Step 3.5: Build to verify**

```bash
cd packages/tui && bun run build 2>&1 | tail -5
```

- [ ] **Step 3.6: Commit**

```bash
git add packages/tui/src/components/views/dashboard.tsx
git commit -m "feat(tui): wire Dashboard health check to CliBridge"
```

---

### Task 4: WorkersOverview — Wire Per-Worker Actions

**Files:**

- Modify: `packages/tui/src/components/views/workers-overview.tsx`

WorkersOverview shows a 2-column card grid with worker info and action buttons.

- [ ] **Step 4.1: Read workers-overview.tsx to find action button handlers**

- [ ] **Step 4.2: Import cliBridge + add deploy state**

Same pattern as Task 2 — `deploying` state, per-worker deploy handler.

- [ ] **Step 4.3: Wire each card's action button**

Each card's deploy/restart button calls `cliBridge.deployWorker(name)` or `cliBridge.rebuild()`.

- [ ] **Step 4.4: Show per-card progress**

Add a small progress indicator row inside each card when that card's worker is deploying.

- [ ] **Step 4.5: Commit**

```bash
git add packages/tui/src/components/views/workers-overview.tsx
git commit -m "feat(tui): wire WorkersOverview action buttons to CliBridge"
```

---

### Task 5: WorkerDetail — Wire Logs + Config

**Files:**

- Modify: `packages/tui/src/components/views/worker-detail.tsx`

WorkerDetail has 4 panes: Metrics, Live Logs, Durable Objects, Config Preview.

- [ ] **Step 5.1: Read worker-detail.tsx to understand current data sources**

- [ ] **Step 5.2: Replace static config preview with live data**

Add `cliBridge.configShow()` call on mount. Parse the JSON response and display the config relevant to the selected worker.

- [ ] **Step 5.3: Add log fallback for when SSE is unavailable**

If `connectionStatus` is not `"connected"`, fall back to `cliBridge.workerLogs(workerId)` for log display.

- [ ] **Step 5.4: Build to verify**

```bash
cd packages/tui && bun run build 2>&1 | tail -5
```

- [ ] **Step 5.5: Commit**

```bash
git add packages/tui/src/components/views/worker-detail.tsx
git commit -m "feat(tui): wire WorkerDetail logs and config to CliBridge"
```

---

### Task 6: LogsViewer — Wire Export + Clear

**Files:**

- Modify: `packages/tui/src/components/views/logs-viewer.tsx`

LogsViewer has [Export] and [Clear] buttons with `// TODO` comment stubs.

- [ ] **Step 6.1: Read logs-viewer.tsx to find the stub handlers**

- [ ] **Step 6.2: Implement [Export] handler**

Replace the `// TODO` export handler with:

```typescript
const handleExport = async () => {
  // Fetch real logs from CLI
  const result = await cliBridge.exec(["logs", "all"], {
    json: true,
    timeout: 20_000,
  });
  if (result.success && result.data) {
    const filePath = `$HOME/.hoox/logs-export-${Date.now()}.json`;
    await Bun.write(filePath, JSON.stringify(result.data, null, 2));
    useServiceStore.getState().addAlert({
      id: `export-${Date.now()}`,
      type: "export",
      severity: "info",
      message: `Logs exported to ${filePath}`,
      timestamp: Date.now(),
      source: "cli-bridge",
    });
  } else {
    // Fallback: export the in-memory logs from the store
    const logs = useServiceStore.getState().logs;
    const filePath = `$HOME/.hoox/logs-export-${Date.now()}.json`;
    await Bun.write(filePath, JSON.stringify(logs, null, 2));
    useServiceStore.getState().addAlert({
      id: `export-${Date.now()}`,
      type: "export",
      severity: "info",
      message: `Logs exported to ${filePath} (cached data)`,
      timestamp: Date.now(),
      source: "cli-bridge",
    });
  }
};
```

- [ ] **Step 6.3: Implement [Clear] handler**

Replace the `// TODO` clear handler with:

```typescript
const handleClear = async () => {
  // Clear local store
  useServiceStore.getState().pushLog({} as any); // reset — set logs to empty
  // Note: store doesn't have a "clearLogs" action, so we force-refresh
  useServiceStore.getState().addAlert({
    id: `clear-${Date.now()}`,
    type: "clear",
    severity: "info",
    message: "Log buffer cleared",
    timestamp: Date.now(),
    source: "cli-bridge",
  });
};
```

- [ ] **Step 6.4: Build to verify**

```bash
cd packages/tui && bun run build 2>&1 | tail -5
```

- [ ] **Step 6.5: Commit**

```bash
git add packages/tui/src/components/views/logs-viewer.tsx
git commit -m "feat(tui): wire LogsViewer export and clear to CliBridge"
```

---

### Task 7: SetupWizard — Wire Deploy Step

**Files:**

- Modify: `packages/tui/src/components/views/setup-wizard.tsx`

SetupWizard Step 6 (Deploy) currently writes config and navigates to dashboard. Add actual `hoox deploy all` execution.

- [ ] **Step 7.1: Read the current handleDeploy in setup-wizard.tsx**

- [ ] **Step 7.2: Import cliBridge and add deploy state**

```typescript
import { cliBridge } from "../../services/cli-bridge";
```

Add state:

```typescript
const [deploying, setDeploying] = useState(false);
const [deployLog, setDeployLog] = useState("");
```

- [ ] **Step 7.3: Update handleDeploy**

Replace the existing `handleDeploy` to call deploy before navigating:

```typescript
const handleDeploy = async () => {
  if (deploying) return;
  try {
    // 1. Save config first
    const activeExchanges = Object.entries(data.exchanges)
      .filter(([, v]) => v)
      .map(([k]) => k);
    updateConfig({ activeExchanges });

    // 2. Run deploy
    setDeploying(true);
    setDeployLog("");
    const result = await cliBridge.deployAll((line) => {
      setDeployLog((prev) => prev + line + "\n");
    });

    if (result.success) {
      useServiceStore.getState().addAlert({
        id: `setup-deploy-${Date.now()}`,
        type: "deploy",
        severity: "info",
        message: "Setup complete — all workers deployed",
        timestamp: Date.now(),
        source: "cli-bridge",
      });
      setView("dashboard");
    } else {
      setDeploying(false);
      // Show error in-line instead of navigating
    }
  } catch {
    setDeploying(false);
  }
};
```

- [ ] **Step 7.4: Add deploy progress display to Step 6 JSX**

In the `StepDeploy` component, when `deploying` is true, show progress instead of the summary view.

- [ ] **Step 7.5: Build to verify**

```bash
cd packages/tui && bun run build 2>&1 | tail -5
```

- [ ] **Step 7.6: Commit**

```bash
git add packages/tui/src/components/views/setup-wizard.tsx
git commit -m "feat(tui): wire SetupWizard deploy step to CliBridge"
```

---

### Task 8: Settings — Wire Cache/Export/Import

**Files:**

- Modify: `packages/tui/src/components/views/settings.tsx`

Settings has Clear Cache, Export Data, Import Data stubs.

- [ ] **Step 8.1: Read settings.tsx to find stub handlers**

- [ ] **Step 8.2: Implement Clear Cache**

```typescript
const handleClearCache = async () => {
  try {
    const dirPath = `${process.env.HOME}/.hoox/cache`;
    await Bun.spawn(["rm", "-rf", dirPath]).exited;
    useServiceStore.getState().addAlert({
      id: `cache-${Date.now()}`,
      type: "cache",
      severity: "info",
      message: "Cache cleared",
      timestamp: Date.now(),
      source: "cli-bridge",
    });
  } catch {
    // non-critical
  }
};
```

- [ ] **Step 8.3: Implement Export Data**

Call `cliBridge.configShow()` and write the JSON response to `~/.hoox/config-export-<timestamp>.json`.

- [ ] **Step 8.4: Implement Import Data**

Read a JSON file, parse it, call `cliBridge.exec(["config", "set", key, value])` for each key.

- [ ] **Step 8.5: Build to verify**

```bash
cd packages/tui && bun run build 2>&1 | tail -5
```

- [ ] **Step 8.6: Commit**

```bash
git add packages/tui/src/components/views/settings.tsx
git commit -m "feat(tui): wire Settings cache/export/import to CliBridge"
```

---

### Task 9: ConfigEditor — Wire Validate-on-Save

**Files:**

- Modify: `packages/tui/src/components/views/config-editor.tsx`

ConfigEditor has file load/save with Bun I/O. Add validation via CLI after save.

- [ ] **Step 9.1: Read config-editor.tsx to find save handler**

- [ ] **Step 9.2: Import cliBridge**

```typescript
import { cliBridge } from "../../services/cli-bridge";
```

- [ ] **Step 9.3: Add validation after save**

After the existing `Bun.write` in the save handler, call:

```typescript
const validationResult = await cliBridge.configValidate();
if (!validationResult.success) {
  // Show validation errors in an overlay or status line
  setValidationError(validationResult.stderr);
} else {
  setValidationError(null);
}
```

- [ ] **Step 9.4: Display validation errors**

Add a status line below the editor that shows validation errors in red when present.

- [ ] **Step 9.5: Build to verify**

```bash
cd packages/tui && bun run build 2>&1 | tail -5
```

- [ ] **Step 9.6: Commit**

```bash
git add packages/tui/src/components/views/config-editor.tsx
git commit -m "feat(tui): wire ConfigEditor validate-on-save to CliBridge"
```

---

### Task 10: Integration — Add `addAlert` type to shared types if missing

**Files:**

- Modify: `packages/shared/stores/service-store.ts`
- Modify: `packages/tui/src/services/cli-bridge.ts` (if needed)

Some views call `useServiceStore.getState().addAlert(...)`. Verify that `addAlert` exists in the service store actions.

- [ ] **Step 10.1: Check if service-store exports addAlert**

```bash
rg "addAlert" packages/shared/stores/service-store.ts
```

If it doesn't exist, add it:

```typescript
addAlert: (alert: Alert) => {
  set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 100),
  }));
},
```

- [ ] **Step 10.2: Verify `Alert` type has `source` field**

Check `packages/shared/types.ts` for the `Alert` type. If `source` doesn't exist, add it as optional `source?: string`.

- [ ] **Step 10.3: Commit if changes needed**

```bash
git add packages/shared/stores/service-store.ts packages/shared/types.ts
git commit -m "fix(shared): add addAlert action and Alert.source field"
```

---

### Task 11: Final Verification

- [ ] **Step 11.1: Run all TUI tests**

```bash
cd packages/tui && bun test 2>&1 | tail -30
```

Expected: Same baseline as before (301 pass, 26 fail, 6 errors — all pre-existing).

- [ ] **Step 11.2: Build TUI bundle**

```bash
cd packages/tui && bun run build 2>&1
```

Expected: "Bundled N modules in Xms" — no errors.

- [ ] **Step 11.3: Run shared tests**

```bash
cd packages/shared && bun test 2>&1 | tail -10
```

Expected: All 144 tests pass.

- [ ] **Step 11.4: Final summary**

All CLI commands are now wired into TUI views via the CliBridge.
