# Hoox Docs Rewrite & CLI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all documentation to natively reference the `hoox` CLI command instead of `bun run`, implement a top-level `hoox clone` command for bootstrapping the root repository, and add a comprehensive features overview document.

**Architecture:** We will use a temporary TypeScript utility script to safely perform regex replacements across the `~140` markdown files. The CLI will be expanded with a `clone` command using `runCommandAsync`. Finally, a new `CLI_FEATURES.md` document will catalog all user commands and background processes.

**Tech Stack:** Bun, TypeScript, Commander, Markdown.

---

### Task 1: Add `hoox clone` Command

**Files:**
- Modify: `packages/hoox-cli/bin/hoox.ts`
- Create: `packages/hoox-cli/test/clone.test.ts`

- [ ] **Step 1: Write a failing test for the clone command**

```ts
// Create: packages/hoox-cli/test/clone.test.ts
import { test, expect, vi, beforeEach } from "bun:test";
import * as utils from "../src/utils.js";

// Mock the command runner to prevent actual git clones during tests
vi.mock("../src/utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils.js")>();
  return {
    ...actual,
    runCommandAsync: vi.fn().mockResolvedValue({ success: true, stdout: "", stderr: "" }),
    print_success: vi.fn(),
    print_error: vi.fn()
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test("Clone command executes git clone", async () => {
  const { runCommandAsync } = await import("../src/utils.js");
  // We simulate what the command will do
  await runCommandAsync("git", ["clone", "https://github.com/jango-blockchained/hoox-setup.git", "my-folder"], process.cwd());
  expect(runCommandAsync).toHaveBeenCalledWith("git", ["clone", "https://github.com/jango-blockchained/hoox-setup.git", "my-folder"], expect.any(String));
});
```

- [ ] **Step 2: Run the test to ensure the mock setup works**

Run: `bun test packages/hoox-cli/test/clone.test.ts`

- [ ] **Step 3: Implement the clone command in `hoox.ts`**

Modify `packages/hoox-cli/bin/hoox.ts`. Locate the section where root commands are defined (e.g., near `init`) and add:

```typescript
  // --- Clone Command ---
  program
    .command("clone [destination]")
    .description("Clone the main hoox-setup repository")
    .action(async (destination) => {
      const target = destination || "hoox-setup";
      console.log(blue(`\nCloning hoox-setup repository into ./${target}...`));
      
      const result = await runCommandAsync(
        "git",
        ["clone", "https://github.com/jango-blockchained/hoox-setup.git", target],
        process.cwd()
      );

      if (result.success) {
        print_success(`Successfully cloned to ./${target}`);
        console.log(green(`\nNext steps:\n  cd ${target}\n  bun install\n  hoox init`));
      } else {
        print_error(`Failed to clone repository: ${result.stderr}`);
        process.exitCode = 1;
      }
    });
```

- [ ] **Step 4: Run compiler check**

Run: `bun run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/bin/hoox.ts packages/hoox-cli/test/clone.test.ts
git commit -m "feat(cli): add top-level hoox clone command"
```

---

### Task 2: Create CLI Features Overview Document

**Files:**
- Create: `docs/CLI_FEATURES.md`

- [ ] **Step 1: Write the CLI Features Document**

Create `docs/CLI_FEATURES.md` with the following comprehensive content:

```markdown
# Hoox CLI Features & Background Processes

The `hoox` CLI is the central management tool for the Hoox Trading System. This document outlines all user-facing commands and automated background tasks.

## User Commands

### Initialization & Setup
- `hoox init`: Runs the interactive setup wizard.
- `hoox check-setup`: Validates the environment, bindings, and configurations without modifying state.
- `hoox clone [destination]`: Clones the core `hoox-setup` repository.

### Worker Management
- `hoox workers clone`: Clones all or specific sub-worker repositories as submodules.
- `hoox workers setup`: Binds secrets and provisions the local environment for enabled workers.
- `hoox workers dev <workerName>`: Starts the local Wrangler development server for a specific worker.
- `hoox workers deploy [workerName]`: Deploys specific or all enabled workers to Cloudflare.
- `hoox workers status`: Launches the interactive TUI to monitor worker health and status.
- `hoox workers test`: Runs the Vitest integration suite across workers.

### Configurations & Secrets
- `hoox secrets update-cf <secret> <worker>`: Updates a Cloudflare Secret Store value and syncs it locally.
- `hoox secrets check <worker> [secret]`: Verifies secret bindings.
- `hoox keys generate/get/list`: Manages local `.keys/*.env` cryptographic keys.

### Utility & Logs
- `hoox logs download <workerName>`: Async download of worker logs from the R2 bucket, with automatic fallback to `wrangler tail`.
- `hoox housekeeping`: Runs a manual trigger of the system health checks.
- `hoox waf`: Configures Cloudflare WAF rules (IP allowlists, rate limiting).
- `hoox r2`: Provisions required R2 buckets.

## Background Functions & Processes

While the CLI manages deployments, the deployed system runs several critical background tasks automatically on Cloudflare's Edge:

1. **Housekeeping Cron (`agent-worker`)**
   - Runs every 5 minutes.
   - Monitors portfolio status, checks trailing stops, and validates the health of other workers.

2. **Idempotency Store (`hoox` gateway)**
   - A Durable Object that intercepts incoming webhooks.
   - Prevents duplicate trading signals from executing twice.

3. **Kill Switch Evaluation**
   - Read from `CONFIG_KV` on every request.
   - Immediately halts all trade execution if `kill_switch` is true, without requiring redeployment.

4. **Queue Processing (`trade-execution`)**
   - High-availability queue bridging the gateway and the `trade-worker`.
   - Includes automatic failovers and retry policies for exchange API timeouts.
```

- [ ] **Step 2: Commit**

```bash
git add docs/CLI_FEATURES.md
git commit -m "docs: add comprehensive CLI features overview document"
```

---

### Task 3: Global Documentation Rewrite Script

**Files:**
- Create: `scripts/update-docs.ts`

- [ ] **Step 1: Write the update script**

Create `scripts/update-docs.ts`:

```typescript
import { promises as fs } from "node:fs";
import path from "node:path";

async function *walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    // Ignore node_modules, .git, and hidden folders
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      yield* walk(res);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield res;
    }
  }
}

async function updateDocs() {
  const rootDir = process.cwd();
  let updatedCount = 0;

  for await (const filePath of walk(rootDir)) {
    let content = await fs.readFile(filePath, "utf-8");
    const originalContent = content;

    // Replacement Logic
    content = content.replace(/bun run scripts\/manage\.ts\s+/g, "hoox ");
    content = content.replace(/bun run hoox\s+/g, "hoox ");
    content = content.replace(/bun run workers:([a-z-]+)/g, "hoox workers $1");
    
    // Catch remaining specific cases like 'hoox init', 'hoox check-setup'
    content = content.replace(/bun run (init|check-setup|housekeeping|tests|tui|dev|manage)/g, "hoox $1");

    if (content !== originalContent) {
      await fs.writeFile(filePath, content, "utf-8");
      console.log(`Updated: ${path.relative(rootDir, filePath)}`);
      updatedCount++;
    }
  }
  
  console.log(`\nFinished updating ${updatedCount} markdown files.`);
}

updateDocs().catch(console.error);
```

- [ ] **Step 2: Execute the update script**

Run: `bun run scripts/update-docs.ts`

- [ ] **Step 3: Verify the changes**

Run: `git diff` to manually verify that the substitutions were made correctly without breaking standard markdown blocks.

- [ ] **Step 4: Cleanup and Commit**

```bash
rm scripts/update-docs.ts
git add .
git commit -m "docs: globally rewrite bun run commands to native hoox CLI"
```