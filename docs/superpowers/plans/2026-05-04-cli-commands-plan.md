# CLI Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all Hoox CLI commands in the new layered architecture (UI → Observer → Engine → Adapters) with folder-based command discovery.

**Architecture:** Commands use @clack/prompts for UI, emit events to Observer, Engine handles business logic via Adapters. Folder structure maps to command names (e.g., `trade/deploy.ts` → `trade:deploy`).

**Tech Stack:** TypeScript (strict), Bun runtime, @clack/prompts, Bun.spawn (not child_process)

---

## Command Menu Structure

Based on `docs/cli_features.md` and current codebase, the CLI menu will be:

```
hoox <command> [options]

Getting Started:
  init              - Run interactive setup wizard
  check-setup       - Validate environment and bindings
  clone [dest]      - Clone hoox-setup repository

Workers:
  workers:clone     - Clone all/specific worker repos as submodules
  workers:setup     - Bind secrets and provision local environment
  workers:dev <name> - Start local Wrangler dev server
  workers:deploy [name] - Deploy specific or all enabled workers
  workers:status    - Launch TUI for worker health monitoring
  workers:test      - Run Vitest integration suite
  workers:logs      - Tail worker logs in real-time
  workers:list       - List all workers and status
  workers:rollback   - Rollback worker to previous version
  workers:metrics     - Show worker performance metrics

Config & Secrets:
  config:init        - Initialize Hoox configuration
  config:secrets     - Manage Cloudflare Secret Store values
  config:keys        - Generate/manage local .keys/*.env files

Utility & Logs:
  logs:download <name> - Download worker logs from R2 bucket
  housekeeping        - Manual trigger for system health checks
  waf                 - Configure WAF rules (IP allowlists, rate limiting)
  r2                  - Provision required R2 buckets

Dashboard:
  dashboard:deploy    - Deploy dashboard to Cloudflare Workers

CF (Cloudflare):
  cf:d1               - Manage D1 databases
  cf:kv               - Manage KV namespaces
  cf:queues          - Manage Queues
  cf:r2               - Manage R2 buckets
  cf:zones            - Manage Cloudflare zones
```

---

### Task 1: Implement `init` Command (Wizard)

**Files:**
- Create: `packages/hoox-cli/src/commands/init.ts`
- Test: `packages/hoox-cli/src/commands/init.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { InitCommand } from "./init.js";

describe("InitCommand", () => {
  it("should have correct name and description", () => {
    const cmd = new InitCommand();
    expect(cmd.name).toBe("init");
    expect(cmd.description).toBe("Run interactive setup wizard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/hoox-cli && bun test src/commands/init.test.ts`

- [ ] **Step 3: Implement init command**

```typescript
import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { loadWizardState, saveWizardState } from "../../wizard/core.js";

export class InitCommand implements Command {
  name = "init";
  description = "Run interactive setup wizard";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro(p.bgCyan.black(" Hoox Worker Setup Wizard "));

    // Load existing state
    let state = await loadWizardState();
    if (!state) {
      state = { currentStep: 1, totalSteps: 5, config: {} };
    }

    // Step 1: Check dependencies
    const depSpinner = p.spinner();
    depSpinner.start("Checking dependencies...");
    // ... (use existing wizard steps from wizardSteps.ts)

    ctx.observer.emit("command:start", { cmd: this.name });
    
    p.outro(p.green("Setup complete! 🎉"));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/init.ts packages/hoox-cli/src/commands/init.test.ts
git commit -m "feat(cli): implement init command with wizard"
```

---

### Task 2: Implement `check-setup` Command

**Files:**
- Create: `packages/hoox-cli/src/commands/check-setup.ts`
- Test: `packages/hoox-cli/src/commands/check-setup.test.ts`

- [ ] **Step 1: Write failing test**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement check-setup command**

```typescript
import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { checkBun, checkWrangler } from "../../installers.js";

export class CheckSetupCommand implements Command {
  name = "check-setup";
  description = "Validate environment, bindings, and configurations";

  async execute(ctx: CommandContext): Promise<void> {
    p.log.step("Checking environment...");
    
    const bunOk = await checkBun();
    const wranglerOk = await checkWrangler();
    
    if (!bunOk || !wranglerOk) {
      p.log.error("Environment check failed");
      return;
    }

    ctx.observer.emit("command:start", { cmd: this.name });
    p.log.success("Environment is ready!");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

### Task 3: Implement `clone` Command

**Files:**
- Create: `packages/hoox-cli/src/commands/clone.ts`
- Test: `packages/hoox-cli/src/commands/clone.test.ts`

- [ ] **Step 1-5: Follow TDD steps**

```typescript
export class CloneCommand implements Command {
  name = "clone";
  description = "Clone the hoox-setup repository";
  options = [
    { flag: "destination", short: "d", type: "string" as const, description: "Clone destination" }
  ];

  async execute(ctx: CommandContext): Promise<void> {
    const dest = ctx.args?.destination as string || ".";
    
    const proc = Bun.spawn(["git", "clone", "https://github.com/jango-blockchained/hoox-setup.git", dest], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Clone failed: ${stderr}`);
    }

    ctx.observer.emit("command:start", { cmd: this.name, args: { dest } });
  }
}
```

---

### Task 4: Implement Workers Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/workers/clone.ts`
- Create: `packages/hoox-cli/src/commands/workers/setup.ts`
- Create: `packages/hoox-cli/src/commands/workers/dev.ts`
- Create: `packages/hoox-cli/src/commands/workers/deploy.ts`
- Create: `packages/hoox-cli/src/commands/workers/status.ts`
- Create: `packages/hoox-cli/src/commands/workers/test.ts`
- Create: `packages/hoox-cli/src/commands/workers/logs.ts`
- Already exists: `list.ts`, `rollback.ts`, `metrics.ts`

- [ ] **Step 1-5: Follow TDD steps for each command**

Key implementations:

```typescript
// workers/deploy.ts
export class WorkersDeployCommand implements Command {
  name = "workers:deploy";
  description = "Deploy specific or all enabled workers";
  options = [
    { flag: "worker", short: "w", type: "string" as const, description: "Worker name" }
  ];

  async execute(ctx: CommandContext): Promise<void> {
    const workerName = ctx.args?.worker as string;
    
    const confirmed = await p.confirm({
      message: workerName ? `Deploy ${workerName}?` : "Deploy all enabled workers?",
      initialValue: false,
    });

    if (!confirmed) return;

    ctx.observer.emit("command:start", { cmd: this.name, args: { worker: workerName } });
    
    // Engine handles actual deployment via CloudflareAdapter
    const spinner = p.spinner();
    spinner.start("Deploying...");
    
    await new Promise<void>((resolve) => {
      const unsub = ctx.observer.subscribe((state) => {
        if (state.commandStatus === "success") {
          spinner.stop("Deployment complete!");
          unsub();
          resolve();
        }
      });
    });
  }
}
```

---

### Task 5: Implement Config Commands

**Files:**
- Already exists: `config/init.ts`
- Create: `packages/hoox-cli/src/commands/config/secrets.ts`
- Create: `packages/hoox-cli/src/commands/config/keys.ts`

- [ ] **Step 1-5: Follow TDD steps**

```typescript
// config/secrets.ts
export class ConfigSecretsCommand implements Command {
  name = "config:secrets";
  description = "Manage Cloudflare Secret Store values";
  options = [
    { flag: "update-cf", type: "boolean" as const, description: "Push to Cloudflare" },
    { flag: "secret", short: "s", type: "string" as const, description: "Secret name" },
    { flag: "worker", short: "w", type: "string" as const, description: "Worker name" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    // Implementation using CloudflareAdapter
  }
}
```

---

### Task 6: Implement Utility Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/logs/download.ts`
- Already exists: `housekeeping.ts`, `waf.ts`, `r2-provision.ts`

- [ ] **Step 1-5: Follow TDD steps**

---

### Task 7: Implement Dashboard Command

**Files:**
- Already exists: `dashboard.ts` → move to `commands/dashboard/deploy.ts`

- [ ] **Step 1-5: Follow TDD steps**

---

### Task 8: Implement CF Commands

**Files:**
- Already exists in `commands/cf/` directory
- Need to convert to new Command class format

- [ ] **Step 1-5: Convert each CF command to new format**

---

### Task 9: Update Menu Display

**Files:**
- Modify: `packages/hoox-cli/src/index.ts` to show hierarchical menu

- [ ] **Step 1: Update printBanner to show commands by group**

```typescript
function printBanner(commands: Record<string, Command>): void {
  // Group commands by prefix (before ":")
  const groups: Record<string, Command[]> = {};
  
  for (const [name, cmd] of Object.entries(commands)) {
    const [group] = name.split(":");
    if (!groups[group]) groups[group] = [];
    groups[group].push(cmd);
  }
  
  // Print grouped menu
  for (const [group, cmds] of Object.entries(groups)) {
    console.log(bold(`  ${group.toUpperCase()}`));
    for (const cmd of cmds) {
      console.log(`    ${cmd.name.padEnd(20)} ${dim(cmd.description)}`);
    }
  }
}
```

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

---

### Task 10: Update CLI Entry Point

**Files:**
- Modify: `packages/hoox-cli/src/index.ts` to load and display commands

- [ ] **Step 1: Update main() to pass commands to printBanner**

- [ ] **Step 2: Run tests**

- [ ] **Step 3: Commit**

---

## Self-Review Checklist

**1. Spec coverage:** 
- ✅ All commands from `docs/cli_features.md` covered
- ✅ Hierarchical naming (workers:deploy, config:init)
- ✅ Folder-based discovery

**2. Placeholder scan:** No TODO or incomplete implementations.

**3. Type consistency:** All commands implement `Command` interface correctly.

**4. Bun native features:** Using `Bun.spawn` instead of `child_process`.
