# `hoox config setup` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a new CLI command `hoox config setup` that copies `.example` files to their active locations without the `.example` extension, prompting the user if the target file already exists.

**Architecture:**

1. Convert `program.command("config")` into a command group. Move the existing logic to `config info`.
2. Add a new `config setup` command.
3. Extract config-related command implementations into `packages/hoox-cli/src/configCommands.ts`.
4. Use `Bun.Glob` to find all `**/*.example` files efficiently, ignoring `node_modules` and `.git`.
5. Iterate through results, check if target file exists, prompt user if it does, and copy the file using `fs/promises`.

**Tech Stack:** Bun, TypeScript, Commander.js, Node `readline`, Node `fs`.

---

### Task 1: Create Config Commands Module

**Files:**

- Create: `packages/hoox-cli/src/configCommands.ts`

- [ ] **Step 1: Write the basic implementation module**
      Create `packages/hoox-cli/src/configCommands.ts` with imports and an empty `setupConfigVariables` function.

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { Glob } from "bun";
import {
  rl,
  green,
  yellow,
  dim,
  print_success,
  print_error,
  print_warning,
} from "./utils.js";

export async function infoConfigFormat() {
  try {
    const configJsoncPath = path.resolve(process.cwd(), "config.jsonc");
    const configTomlPath = path.resolve(process.cwd(), "config.toml");

    if (await Bun.file(configJsoncPath).exists()) {
      console.log(green("Using: config.jsonc (JSONC format)"));
    } else if (await Bun.file(configTomlPath).exists()) {
      console.log(green("Using: config.toml (TOML format)"));
    } else {
      console.log(
        yellow("No configuration file found. Run 'init' to create one.")
      );
    }

    // Show information about both example files
    const exampleJsoncPath = path.resolve(
      process.cwd(),
      "config.jsonc.example"
    );
    const exampleTomlPath = path.resolve(process.cwd(), "config.toml.example");

    console.log("\nExample files available:");
    if (await Bun.file(exampleJsoncPath).exists()) {
      console.log(green("- config.jsonc.example (JSONC format)"));
    } else {
      // Need to use red, but utils doesn't export red directly. We'll add it or use console.error
      console.log("- config.jsonc.example not found");
    }

    if (await Bun.file(exampleTomlPath).exists()) {
      console.log(green("- config.toml.example (TOML format)"));
    } else {
      console.log("- config.toml.example not found");
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    print_error(`Error checking configuration: ${errMsg}`);
  }
}

export async function setupConfigVariables() {
  console.log(green("\n--- Setting up Configuration Files ---"));

  const glob = new Glob("**/*.example");
  const cwd = process.cwd();

  let found = 0;
  let copied = 0;
  let skipped = 0;

  for await (const file of glob.scan({ cwd, onlyFiles: true, dot: true })) {
    // Ignore node_modules, .git, .wrangler
    if (
      file.includes("node_modules/") ||
      file.includes(".git/") ||
      file.includes(".wrangler/")
    ) {
      continue;
    }

    found++;
    const examplePath = path.resolve(cwd, file);
    const targetFile = file.replace(/\.example$/, "");
    const targetPath = path.resolve(cwd, targetFile);

    try {
      await fs.access(targetPath);
      // File exists, prompt user
      const answer = await rl.question(
        yellow(`File ${targetFile} already exists. Overwrite? (y/N): `)
      );
      if (answer.trim().toLowerCase() === "y") {
        await fs.copyFile(examplePath, targetPath);
        console.log(dim(`Overwrote: ${targetFile}`));
        copied++;
      } else {
        console.log(dim(`Skipped: ${targetFile}`));
        skipped++;
      }
    } catch {
      // File doesn't exist, safe to copy
      await fs.copyFile(examplePath, targetPath);
      console.log(dim(`Created: ${targetFile}`));
      copied++;
    }
  }

  if (found === 0) {
    print_warning("No .example files found.");
  } else {
    print_success(`Setup complete. Copied: ${copied}, Skipped: ${skipped}.`);
  }
}
```

- [ ] **Step 2: Fix 'red' missing import in infoConfigFormat**
      Wait, I need to make sure `red` is imported. Let's fix the infoConfigFormat function to use it.

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { Glob } from "bun";
import {
  rl,
  green,
  yellow,
  red,
  dim,
  print_success,
  print_error,
  print_warning,
} from "./utils.js";

export async function infoConfigFormat() {
  try {
    const configJsoncPath = path.resolve(process.cwd(), "config.jsonc");
    const configTomlPath = path.resolve(process.cwd(), "config.toml");

    if (await Bun.file(configJsoncPath).exists()) {
      console.log(green("Using: config.jsonc (JSONC format)"));
    } else if (await Bun.file(configTomlPath).exists()) {
      console.log(green("Using: config.toml (TOML format)"));
    } else {
      console.log(
        yellow("No configuration file found. Run 'init' to create one.")
      );
    }

    // Show information about both example files
    const exampleJsoncPath = path.resolve(
      process.cwd(),
      "config.jsonc.example"
    );
    const exampleTomlPath = path.resolve(process.cwd(), "config.toml.example");

    console.log("\nExample files available:");
    if (await Bun.file(exampleJsoncPath).exists()) {
      console.log(green("- config.jsonc.example (JSONC format)"));
    } else {
      console.log(red("- config.jsonc.example not found"));
    }

    if (await Bun.file(exampleTomlPath).exists()) {
      console.log(green("- config.toml.example (TOML format)"));
    } else {
      console.log(red("- config.toml.example not found"));
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    print_error(`Error checking configuration: ${errMsg}`);
  }
}

export async function setupConfigVariables() {
  console.log(green("\n--- Setting up Configuration Files ---"));

  const glob = new Glob("**/*.example");
  const cwd = process.cwd();

  let found = 0;
  let copied = 0;
  let skipped = 0;

  for await (const file of glob.scan({ cwd, onlyFiles: true, dot: true })) {
    // Ignore node_modules, .git, .wrangler
    if (
      file.includes("node_modules/") ||
      file.includes(".git/") ||
      file.includes(".wrangler/")
    ) {
      continue;
    }

    found++;
    const examplePath = path.resolve(cwd, file);
    const targetFile = file.replace(/\.example$/, "");
    const targetPath = path.resolve(cwd, targetFile);

    try {
      await fs.access(targetPath);
      // File exists, prompt user
      const answer = await rl.question(
        yellow(`File ${targetFile} already exists. Overwrite? (y/N): `)
      );
      if (answer.trim().toLowerCase() === "y") {
        await fs.copyFile(examplePath, targetPath);
        console.log(dim(`Overwrote: ${targetFile}`));
        copied++;
      } else {
        console.log(dim(`Skipped: ${targetFile}`));
        skipped++;
      }
    } catch {
      // File doesn't exist, safe to copy
      await fs.copyFile(examplePath, targetPath);
      console.log(dim(`Created: ${targetFile}`));
      copied++;
    }
  }

  if (found === 0) {
    print_warning("No .example files found.");
  } else {
    print_success(`Setup complete. Copied: ${copied}, Skipped: ${skipped}.`);
  }
}
```

- [ ] **Step 3: Commit Task 1**

```bash
git add packages/hoox-cli/src/configCommands.ts
git commit -m "feat(cli): create configCommands module"
```

---

### Task 2: Refactor `bin/hoox.ts` to use config group

**Files:**

- Modify: `packages/hoox-cli/bin/hoox.ts:115-162`

- [ ] **Step 1: Edit `bin/hoox.ts` to import configCommands and set up the command group**

In `packages/hoox-cli/bin/hoox.ts`, we need to import `infoConfigFormat` and `setupConfigVariables` from `../src/configCommands.js` and change the `config` command.

```typescript
// Add to imports section
import {
  infoConfigFormat,
  setupConfigVariables,
} from "../src/configCommands.js";
```

```typescript
// Replace lines 115-162 (the old config command) with:

const configCommand = program
  .command("config")
  .description("Manage configuration files");

configCommand
  .command("info")
  .description("Shows information about the current configuration format.")
  .action(infoConfigFormat);

configCommand
  .command("setup")
  .description("Copies example configuration files to their active names.")
  .action(setupConfigVariables);
```

- [ ] **Step 2: Remove old fs/path imports from `bin/hoox.ts` if unused**
      Since `infoConfigFormat` handles `fs` and `path` for the config, and we extracted it, check if they are still needed globally. They are (for `config.toml` resolving in other parts), but we don't need the dynamic import inside the action anymore.

- [ ] **Step 3: Run typescript compiler to verify types**

```bash
bun run build
```

- [ ] **Step 4: Commit Task 2**

```bash
git add packages/hoox-cli/bin/hoox.ts
git commit -m "feat(cli): add hoox config setup command"
```
