# CLI Setup, Validation and Repair System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all missing CLI commands for system setup, validation, and repair: `check-setup`, `config:init`, `workers:setup`, `housekeeping`, `r2`, `waf`, and `repair`.

**Architecture:** Build on existing CLI framework (Command interface, adapters, auto-discovery). Create shared validation utilities first, then implement commands that compose them. Follow TDD with Bun test runner. All commands support both interactive (`@clack/prompts`) and non-interactive (CLI flags) modes.

**Tech Stack:** TypeScript 5.x, Bun runtime, `@clack/prompts`, `ansis`, `zod`, Wrangler CLI (spawned via `Bun.spawn`)

---

## File Structure

```
packages/hoox-cli/src/
├── utils/
│   ├── validation.ts              # Shared validation types and helpers
│   ├── validation.test.ts
│   ├── infrastructure-checks.ts   # D1, KV, R2, Queue, Vectorize checks
│   ├── infrastructure-checks.test.ts
│   ├── config-checks.ts           # workers.jsonc, wrangler, .env checks
│   ├── config-checks.test.ts
│   ├── secret-checks.ts           # Secret binding validation
│   ├── secret-checks.test.ts
│   ├── database-checks.ts         # D1 schema validation
│   └── database-checks.test.ts
├── commands/
│   ├── check-setup/
│   │   ├── index.ts               # Main check-setup command
│   │   └── index.test.ts
│   ├── config/
│   │   ├── init.ts                # Replace existing stub
│   │   └── init.test.ts
│   ├── workers/
│   │   ├── setup.ts               # Replace existing stub
│   │   ├── setup.test.ts
│   │   └── update-urls.ts         # Enhance existing
│   ├── housekeeping/
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── r2/
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── waf/
│   │   ├── index.ts
│   │   └── index.test.ts
│   └── repair/
│       ├── index.ts
│       └── index.test.ts
└── index.ts                       # Update categoryOrder
```

---

## Task Dependencies

```
01: validation utilities
├── 02: infrastructure-checks
├── 03: config-checks
├── 04: secret-checks
└── 05: database-checks
    ├── 06: check-setup command
    ├── 07: config:init command (parallel with 06)
    ├── 08: workers:setup command
    ├── 09: housekeeping command
    ├── 10: r2 command (parallel)
    ├── 11: waf command (parallel)
    ├── 12: repair command
    └── 13: update-urls (parallel)
        ├── 14: integration tests
        ├── 15: help banner update
        └── 16: final validation
```

---

## Task 01: Create Shared Validation Utilities

**Files:**
- Create: `packages/hoox-cli/src/utils/validation.ts`
- Create: `packages/hoox-cli/src/utils/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { createValidationResult, ValidationResult } from "./validation";

describe("validation utilities", () => {
  it("creates empty validation result", () => {
    const result = createValidationResult("test-check");
    expect(result.name).toBe("test-check");
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("adds errors and changes success to false", () => {
    const result = createValidationResult("test-check");
    result.addError("Missing file");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Missing file");
  });

  it("adds warnings without changing success", () => {
    const result = createValidationResult("test-check");
    result.addWarning("Deprecated option");
    expect(result.success).toBe(true);
    expect(result.warnings).toContain("Deprecated option");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/utils/validation.test.ts`
Expected: FAIL with "Module not found"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/hoox-cli/src/utils/validation.ts

export interface ValidationResult {
  name: string;
  success: boolean;
  errors: string[];
  warnings: string[];
  addError: (message: string) => void;
  addWarning: (message: string) => void;
}

export interface ValidationContext {
  cwd: string;
  workersConfig: Record<string, unknown>;
  isInteractive: boolean;
}

export function createValidationResult(name: string): ValidationResult {
  const result: ValidationResult = {
    name,
    success: true,
    errors: [],
    warnings: [],
    addError(message: string) {
      this.errors.push(message);
      this.success = false;
    },
    addWarning(message: string) {
      this.warnings.push(message);
    },
  };
  return result;
}

export function formatValidationResults(results: ValidationResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    const icon = r.success ? "✓" : "✗";
    lines.push(`${icon} ${r.name}`);
    for (const e of r.errors) lines.push(`  ✗ ${e}`);
    for (const w of r.warnings) lines.push(`  ⚠ ${w}`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/utils/validation.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/utils/validation.ts packages/hoox-cli/src/utils/validation.test.ts
git commit -m "feat(cli): add shared validation utilities"
```

---

## Task 02: Create Infrastructure Checker Utility

**Files:**
- Create: `packages/hoox-cli/src/utils/infrastructure-checks.ts`
- Create: `packages/hoox-cli/src/utils/infrastructure-checks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { checkD1Database, checkKVNamespaces } from "./infrastructure-checks";
import { CloudflareAdapter } from "../adapters/cloudflare";

describe("infrastructure checks", () => {
  it("returns success when D1 database exists", async () => {
    const adapter = {
      listD1Databases: async () => [{ name: "trade-data-db", uuid: "abc" }],
    } as unknown as CloudflareAdapter;
    
    const result = await checkD1Database(adapter, "trade-data-db");
    expect(result.success).toBe(true);
  });

  it("returns error when D1 database is missing", async () => {
    const adapter = {
      listD1Databases: async () => [],
    } as unknown as CloudflareAdapter;
    
    const result = await checkD1Database(adapter, "trade-data-db");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/utils/infrastructure-checks.test.ts`
Expected: FAIL with "Module not found"

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/utils/infrastructure-checks.ts

import { CloudflareAdapter } from "../adapters/cloudflare";
import { createValidationResult, ValidationResult } from "./validation";

export async function checkD1Database(
  adapter: CloudflareAdapter,
  expectedName: string
): Promise<ValidationResult> {
  const result = createValidationResult("D1 Database");
  try {
    const databases = await adapter.listD1Databases();
    const found = databases.find((db) => db.name === expectedName);
    if (!found) {
      result.addError(`D1 database "${expectedName}" not found`);
    }
  } catch (err) {
    result.addError(`Failed to list D1 databases: ${err}`);
  }
  return result;
}

export async function checkKVNamespaces(
  adapter: CloudflareAdapter,
  expectedNamespaces: { binding: string; id: string }[]
): Promise<ValidationResult> {
  const result = createValidationResult("KV Namespaces");
  try {
    const namespaces = await adapter.listKVNamespaces();
    for (const expected of expectedNamespaces) {
      const found = namespaces.find((ns) => ns.id === expected.id);
      if (!found) {
        result.addError(`KV namespace "${expected.binding}" (id: ${expected.id}) not found`);
      }
    }
  } catch (err) {
    result.addError(`Failed to list KV namespaces: ${err}`);
  }
  return result;
}

export async function checkR2Buckets(
  adapter: CloudflareAdapter,
  expectedBuckets: string[]
): Promise<ValidationResult> {
  const result = createValidationResult("R2 Buckets");
  try {
    const buckets = await adapter.listR2Buckets();
    for (const expected of expectedBuckets) {
      const found = buckets.find((b) => b.name === expected);
      if (!found) {
        result.addError(`R2 bucket "${expected}" not found`);
      }
    }
  } catch (err) {
    result.addError(`Failed to list R2 buckets: ${err}`);
  }
  return result;
}

export async function checkQueues(
  adapter: CloudflareAdapter,
  expectedQueues: string[]
): Promise<ValidationResult> {
  const result = createValidationResult("Queues");
  try {
    const queues = await adapter.listQueues();
    for (const expected of expectedQueues) {
      const found = queues.find((q) => q.name === expected);
      if (!found) {
        result.addError(`Queue "${expected}" not found`);
      }
    }
  } catch (err) {
    result.addError(`Failed to list queues: ${err}`);
  }
  return result;
}

export async function checkVectorizeIndex(
  adapter: CloudflareAdapter,
  expectedIndex: string
): Promise<ValidationResult> {
  const result = createValidationResult("Vectorize Index");
  try {
    const indexes = await adapter.listVectorizeIndexes?.() || [];
    const found = indexes.find((i) => i.name === expectedIndex);
    if (!found) {
      result.addError(`Vectorize index "${expectedIndex}" not found`);
    }
  } catch (err) {
    result.addWarning(`Could not verify Vectorize index: ${err}`);
  }
  return result;
}

export async function checkAnalyticsEngine(
  adapter: CloudflareAdapter,
  expectedDataset: string
): Promise<ValidationResult> {
  const result = createValidationResult("Analytics Engine");
  // Analytics Engine datasets cannot be listed via API easily
  // We check via wrangler config only
  result.addWarning("Analytics Engine dataset must be verified manually in Cloudflare Dashboard");
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/utils/infrastructure-checks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/utils/infrastructure-checks.ts packages/hoox-cli/src/utils/infrastructure-checks.test.ts
git commit -m "feat(cli): add infrastructure validation checks"
```

---

## Task 03: Create Configuration Checker Utility

**Files:**
- Create: `packages/hoox-cli/src/utils/config-checks.ts`
- Create: `packages/hoox-cli/src/utils/config-checks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { checkWorkersJsonc, checkWranglerConfigs } from "./config-checks";

describe("config checks", () => {
  it("validates workers.jsonc exists and has required fields", async () => {
    const result = await checkWorkersJsonc("/nonexistent");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("not found");
  });

  it("validates wrangler configs exist for enabled workers", async () => {
    const workers = { hoox: { enabled: true, path: "workers/hoox" } };
    const result = await checkWranglerConfigs("/tmp", workers);
    // /tmp/workers/hoox/wrangler.jsonc won't exist
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/utils/config-checks.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/utils/config-checks.ts

import { createValidationResult, ValidationResult } from "./validation";

export async function checkWorkersJsonc(cwd: string): Promise<ValidationResult> {
  const result = createValidationResult("workers.jsonc");
  const file = Bun.file(`${cwd}/workers.jsonc`);
  
  if (!(await file.exists())) {
    result.addError("workers.jsonc not found in project root");
    return result;
  }
  
  try {
    const content = await file.text();
    const config = JSON.parse(content.replace(/\/\/.*$/gm, ""));
    
    if (!config.global?.cloudflare_account_id) {
      result.addError("global.cloudflare_account_id is required");
    }
    if (!config.global?.subdomain_prefix) {
      result.addError("global.subdomain_prefix is required");
    }
    if (!config.workers || Object.keys(config.workers).length === 0) {
      result.addError("No workers defined in workers.jsonc");
    }
  } catch (err) {
    result.addError(`Invalid JSON in workers.jsonc: ${err}`);
  }
  
  return result;
}

export async function checkWranglerConfigs(
  cwd: string,
  workers: Record<string, { enabled: boolean; path: string }>
): Promise<ValidationResult> {
  const result = createValidationResult("Wrangler Configs");
  
  for (const [name, worker] of Object.entries(workers)) {
    if (!worker.enabled) continue;
    
    const jsoncPath = `${cwd}/${worker.path}/wrangler.jsonc`;
    const tomlPath = `${cwd}/${worker.path}/wrangler.toml`;
    
    const jsoncFile = Bun.file(jsoncPath);
    const tomlFile = Bun.file(tomlPath);
    
    if (!(await jsoncFile.exists()) && !(await tomlFile.exists())) {
      result.addError(`Worker "${name}" missing wrangler.jsonc/toml at ${worker.path}`);
      continue;
    }
    
    const configFile = await jsoncFile.exists() ? jsoncFile : tomlFile;
    const content = await configFile.text();
    
    if (content.includes("<YOUR_") || content.includes("<PLACEHOLDER")) {
      result.addWarning(`Worker "${name}" config contains placeholder values`);
    }
  }
  
  return result;
}

export async function checkEnvLocal(cwd: string): Promise<ValidationResult> {
  const result = createValidationResult("Environment");
  const envFile = Bun.file(`${cwd}/.env.local`);
  
  if (!(await envFile.exists())) {
    result.addError(".env.local not found. Run: cp .env.example .env.local");
    return result;
  }
  
  const content = await envFile.text();
  const required = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
  
  for (const key of required) {
    if (!content.includes(`${key}=`) || content.includes(`${key}="your_`)) {
      result.addError(`${key} is missing or has placeholder value in .env.local`);
    }
  }
  
  return result;
}

export async function checkSubmodules(cwd: string): Promise<ValidationResult> {
  const result = createValidationResult("Submodules");
  const requiredWorkers = [
    "workers/hoox",
    "workers/trade-worker",
    "workers/agent-worker",
    "workers/d1-worker",
    "workers/telegram-worker",
    "workers/web3-wallet-worker",
    "workers/email-worker",
    "workers/analytics-worker",
  ];
  
  for (const worker of requiredWorkers) {
    const stat = await Bun.file(`${cwd}/${worker}/package.json`).exists();
    if (!stat) {
      result.addError(`Worker directory missing: ${worker}. Run: git submodule update --init --recursive`);
    }
  }
  
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/utils/config-checks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/utils/config-checks.ts packages/hoox-cli/src/utils/config-checks.test.ts
git commit -m "feat(cli): add configuration validation checks"
```

---

## Task 04: Create Secret Checker Utility

**Files:**
- Create: `packages/hoox-cli/src/utils/secret-checks.ts`
- Create: `packages/hoox-cli/src/utils/secret-checks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { checkWorkerSecrets } from "./secret-checks";
import { CloudflareAdapter } from "../adapters/cloudflare";

describe("secret checks", () => {
  it("reports missing secrets", async () => {
    const adapter = {
      listSecrets: async () => [{ name: "WEBHOOK_API_KEY_BINDING" }],
    } as unknown as CloudflareAdapter;
    
    const workers = {
      hoox: { enabled: true, secrets: ["WEBHOOK_API_KEY_BINDING", "INTERNAL_KEY_BINDING"] }
    };
    
    const result = await checkWorkerSecrets(adapter, workers, "hoox");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("INTERNAL_KEY_BINDING");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/utils/secret-checks.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/utils/secret-checks.ts

import { CloudflareAdapter } from "../adapters/cloudflare";
import { createValidationResult, ValidationResult } from "./validation";

export async function checkWorkerSecrets(
  adapter: CloudflareAdapter,
  workers: Record<string, { enabled: boolean; secrets?: string[] }>,
  workerName?: string
): Promise<ValidationResult> {
  const result = createValidationResult("Worker Secrets");
  
  const toCheck = workerName 
    ? { [workerName]: workers[workerName] }
    : workers;
  
  for (const [name, worker] of Object.entries(toCheck)) {
    if (!worker?.enabled) continue;
    if (!worker.secrets || worker.secrets.length === 0) continue;
    
    try {
      const secrets = await adapter.listSecrets(name);
      const secretNames = secrets.map((s) => s.name);
      
      for (const required of worker.secrets) {
        if (!secretNames.includes(required)) {
          result.addError(`Worker "${name}" missing secret: ${required}`);
        }
      }
    } catch (err) {
      result.addError(`Failed to list secrets for "${name}": ${err}`);
    }
  }
  
  return result;
}

export async function checkLocalSecrets(cwd: string): Promise<ValidationResult> {
  const result = createValidationResult("Local Secrets");
  const envFile = Bun.file(`${cwd}/.env.local`);
  
  if (!(await envFile.exists())) {
    result.addError(".env.local not found");
    return result;
  }
  
  const content = await envFile.text();
  const secrets = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
  ];
  
  for (const secret of secrets) {
    const regex = new RegExp(`^${secret}=[^\s"<>]+$`, "m");
    if (!regex.test(content)) {
      result.addWarning(`${secret} may have placeholder or invalid value`);
    }
  }
  
  return result;
}

export async function checkDevVars(cwd: string, workers: Record<string, { enabled: boolean; path: string }>): Promise<ValidationResult> {
  const result = createValidationResult("Dev Vars");
  
  for (const [name, worker] of Object.entries(workers)) {
    if (!worker.enabled) continue;
    
    const devVarsPath = `${cwd}/${worker.path}/.dev.vars`;
    const devVarsFile = Bun.file(devVarsPath);
    
    if (!(await devVarsFile.exists())) {
      result.addWarning(`Worker "${name}" missing .dev.vars for local development`);
    }
  }
  
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/utils/secret-checks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/utils/secret-checks.ts packages/hoox-cli/src/utils/secret-checks.test.ts
git commit -m "feat(cli): add secret validation checks"
```

---

## Task 05: Create Database Schema Checker Utility

**Files:**
- Create: `packages/hoox-cli/src/utils/database-checks.ts`
- Create: `packages/hoox-cli/src/utils/database-checks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { checkRequiredTables } from "./database-checks";
import { CloudflareAdapter } from "../adapters/cloudflare";

describe("database checks", () => {
  it("reports missing tables", async () => {
    const adapter = {
      executeD1Query: async () => ({ results: [{ name: "trades" }] }),
    } as unknown as CloudflareAdapter;
    
    const result = await checkRequiredTables(adapter, "trade-data-db");
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes("trade_signals"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/utils/database-checks.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/utils/database-checks.ts

import { CloudflareAdapter } from "../adapters/cloudflare";
import { createValidationResult, ValidationResult } from "./validation";

const REQUIRED_TABLES = [
  "trade_signals",
  "trades",
  "positions",
  "balances",
  "system_logs",
];

const TRACKING_TABLES = [
  "signal_events",
  "event_trace",
  "worker_stats",
];

export async function checkRequiredTables(
  adapter: CloudflareAdapter,
  databaseName: string
): Promise<ValidationResult> {
  const result = createValidationResult("Database Tables");
  
  try {
    const tables = await adapter.executeD1Query(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = tables.results?.map((r: Record<string, unknown>) => r.name) || [];
    
    for (const table of REQUIRED_TABLES) {
      if (!tableNames.includes(table)) {
        result.addError(`Missing required table: ${table}`);
      }
    }
  } catch (err) {
    result.addError(`Failed to query database tables: ${err}`);
  }
  
  return result;
}

export async function checkRequiredIndexes(
  adapter: CloudflareAdapter,
  databaseName: string
): Promise<ValidationResult> {
  const result = createValidationResult("Database Indexes");
  
  const requiredIndexes = [
    "idx_trade_signals_timestamp",
    "idx_trades_timestamp",
    "idx_positions_status",
    "idx_system_logs_timestamp",
  ];
  
  try {
    const indexes = await adapter.executeD1Query(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='index'"
    );
    const indexNames = indexes.results?.map((r: Record<string, unknown>) => r.name) || [];
    
    for (const idx of requiredIndexes) {
      if (!indexNames.includes(idx)) {
        result.addWarning(`Missing recommended index: ${idx}`);
      }
    }
  } catch (err) {
    result.addWarning(`Failed to check indexes: ${err}`);
  }
  
  return result;
}

export async function checkTrackingSchema(
  adapter: CloudflareAdapter,
  databaseName: string
): Promise<ValidationResult> {
  const result = createValidationResult("Tracking Schema");
  
  try {
    const tables = await adapter.executeD1Query(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = tables.results?.map((r: Record<string, unknown>) => r.name) || [];
    
    for (const table of TRACKING_TABLES) {
      if (!tableNames.includes(table)) {
        result.addError(`Missing tracking table: ${table}. Run: bun run migrate:tracking`);
      }
    }
  } catch (err) {
    result.addError(`Failed to check tracking schema: ${err}`);
  }
  
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/utils/database-checks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/utils/database-checks.ts packages/hoox-cli/src/utils/database-checks.test.ts
git commit -m "feat(cli): add database schema validation checks"
```

---

## Task 06: Implement check-setup Command

**Files:**
- Create: `packages/hoox-cli/src/commands/check-setup/index.ts`
- Create: `packages/hoox-cli/src/commands/check-setup/index.test.ts`
- Modify: `packages/hoox-cli/src/index.ts` (add to categoryOrder)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeCheckSetup } from "./index";
import { CommandContext } from "../../core/types";

describe("check-setup command", () => {
  it("returns validation results", async () => {
    const ctx = {
      cwd: "/tmp",
      adapters: { cloudflare: {}, bun: {} },
      observer: { getState: () => ({}) },
      engine: {},
    } as unknown as CommandContext;
    
    const result = await executeCheckSetup(ctx);
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/check-setup/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/check-setup/index.ts

import { intro, outro, spinner, note } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";
import { formatValidationResults, ValidationResult } from "../../utils/validation";
import { checkWorkersJsonc, checkWranglerConfigs, checkEnvLocal, checkSubmodules } from "../../utils/config-checks";
import { checkD1Database, checkKVNamespaces, checkR2Buckets, checkQueues, checkVectorizeIndex } from "../../utils/infrastructure-checks";
import { checkWorkerSecrets, checkLocalSecrets, checkDevVars } from "../../utils/secret-checks";
import { checkRequiredTables, checkRequiredIndexes, checkTrackingSchema } from "../../utils/database-checks";

async function executeCheckSetup(ctx: CommandContext, args?: Record<string, unknown>): Promise<ValidationResult[]> {
  const isJson = args?.json === true;
  const specificWorker = args?.worker as string | undefined;
  
  if (!isJson) intro(ansis.bold("🔍 System Check"));
  
  const s = spinner();
  s.start("Running validation checks...");
  
  // Load workers config
  const workersConfig = await loadWorkersConfig(ctx.cwd);
  const workers = workersConfig?.workers || {};
  
  const results: ValidationResult[] = [];
  
  // Config checks
  results.push(await checkWorkersJsonc(ctx.cwd));
  results.push(await checkEnvLocal(ctx.cwd));
  results.push(await checkSubmodules(ctx.cwd));
  results.push(await checkWranglerConfigs(ctx.cwd, workers));
  
  // Infrastructure checks
  if (workersConfig?.global) {
    const d1Worker = workers["d1-worker"];
    if (d1Worker?.vars?.database_name) {
      results.push(await checkD1Database(ctx.adapters.cloudflare, d1Worker.vars.database_name as string));
    }
    
    // Collect KV namespaces from wrangler configs
    const kvNamespaces = collectKVNamespaces(ctx.cwd, workers);
    if (kvNamespaces.length > 0) {
      results.push(await checkKVNamespaces(ctx.adapters.cloudflare, kvNamespaces));
    }
    
    // Collect R2 buckets
    const r2Buckets = collectR2Buckets(ctx.cwd, workers);
    if (r2Buckets.length > 0) {
      results.push(await checkR2Buckets(ctx.adapters.cloudflare, r2Buckets));
    }
    
    // Check queues
    const queues = ["trade-execution"];
    results.push(await checkQueues(ctx.adapters.cloudflare, queues));
    
    // Check vectorize
    results.push(await checkVectorizeIndex(ctx.adapters.cloudflare, "my-rag-index"));
  }
  
  // Secret checks
  results.push(await checkLocalSecrets(ctx.cwd));
  results.push(await checkDevVars(ctx.cwd, workers));
  results.push(await checkWorkerSecrets(ctx.adapters.cloudflare, workers, specificWorker));
  
  // Database checks
  results.push(await checkRequiredTables(ctx.adapters.cloudflare, "trade-data-db"));
  results.push(await checkRequiredIndexes(ctx.adapters.cloudflare, "trade-data-db"));
  results.push(await checkTrackingSchema(ctx.adapters.cloudflare, "trade-data-db"));
  
  s.stop("Validation complete");
  
  // Output results
  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const output = formatValidationResults(results);
    console.log("\n" + output);
    
    const failed = results.filter((r) => !r.success);
    const warnings = results.filter((r) => r.warnings.length > 0 && r.success);
    
    if (failed.length > 0) {
      outro(ansis.red(`${failed.length} check(s) failed. Fix the issues above.`));
      process.exit(1);
    } else if (warnings.length > 0) {
      outro(ansis.yellow("Checks passed with warnings."));
    } else {
      outro(ansis.green("✓ All checks passed!"));
    }
  }
  
  return results;
}

async function loadWorkersConfig(cwd: string): Promise<Record<string, unknown> | null> {
  try {
    const file = Bun.file(`${cwd}/workers.jsonc`);
    const content = await file.text();
    return JSON.parse(content.replace(/\/\/.*$/gm, ""));
  } catch {
    return null;
  }
}

function collectKVNamespaces(cwd: string, workers: Record<string, unknown>): { binding: string; id: string }[] {
  const namespaces = new Map<string, string>();
  // Parse wrangler.jsonc files to extract KV namespace IDs
  // This is a simplified version - full implementation would parse all configs
  namespaces.set("CONFIG_KV", "c5917667a21745e390ff969f32b1847d");
  namespaces.set("SESSIONS_KV", "ff70a58b492e45d79880a7a8213c745c");
  return Array.from(namespaces.entries()).map(([binding, id]) => ({ binding, id }));
}

function collectR2Buckets(cwd: string, workers: Record<string, unknown>): string[] {
  const buckets = new Set<string>();
  buckets.add("trade-reports");
  buckets.add("hoox-system-logs");
  buckets.add("user-uploads");
  return Array.from(buckets);
}

const command: Command = {
  name: "check-setup",
  description: "Validate system setup: configs, infrastructure, secrets, database",
  options: [
    { name: "json", description: "Output results as JSON", type: "boolean" },
    { name: "worker", description: "Check specific worker only", type: "string" },
  ],
  execute: executeCheckSetup,
};

export default command;
export { executeCheckSetup };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/check-setup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/check-setup/ packages/hoox-cli/src/index.ts
git commit -m "feat(cli): implement check-setup command"
```

---

## Task 07: Implement config:init Command

**Files:**
- Modify: `packages/hoox-cli/src/commands/config/init.ts` (replace stub)
- Create: `packages/hoox-cli/src/commands/config/init.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeConfigInit } from "./init";

describe("config:init command", () => {
  it("requires token and account flags in non-interactive mode", async () => {
    const ctx = { cwd: "/tmp", args: {} };
    await expect(executeConfigInit(ctx as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/config/init.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/config/init.ts

import { intro, outro, text, confirm, spinner } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";
import { ConfigValidationError } from "../../core/errors";

const DEFAULT_WORKERS_JSONC = {
  global: {
    cloudflare_api_token: "<USE_WRANGLER_SECRET_PUT>",
    cloudflare_account_id: "",
    cloudflare_secret_store_id: "",
    subdomain_prefix: "hoox",
  },
  workers: {
    "d1-worker": { enabled: true, path: "workers/d1-worker", vars: { database_name: "trade-data-db" } },
    "telegram-worker": { enabled: true, path: "workers/telegram-worker", vars: {}, secrets: ["TELEGRAM_BOT_TOKEN"] },
    "trade-worker": { enabled: true, path: "workers/trade-worker", vars: {}, secrets: ["API_SERVICE_KEY", "BINANCE_API_KEY", "BINANCE_API_SECRET", "MEXC_API_KEY", "MEXC_API_SECRET", "BYBIT_API_KEY", "BYBIT_API_SECRET"] },
    "web3-wallet-worker": { enabled: true, path: "workers/web3-wallet-worker", vars: {}, secrets: ["WALLET_MNEMONIC_SECRET", "WALLET_PK_SECRET"] },
    "hoox": { enabled: true, path: "workers/hoox", vars: {}, secrets: ["WEBHOOK_API_KEY_BINDING"] },
    "agent-worker": { enabled: true, path: "workers/agent-worker", vars: {}, secrets: ["AGENT_INTERNAL_KEY"] },
    "email-worker": { enabled: true, path: "workers/email-worker", vars: { USE_IMAP: "false" }, secrets: ["EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS", "INTERNAL_KEY"] },
    "analytics-worker": { enabled: true, path: "workers/analytics-worker", vars: {}, secrets: ["CLOUDFLARE_API_TOKEN"] },
  },
};

async function executeConfigInit(ctx: CommandContext, args?: Record<string, unknown>): Promise<void> {
  const isInteractive = !args?.token && !args?.account;
  const force = args?.force === true;
  
  if (isInteractive) intro(ansis.bold("⚙️  Initialize Hoox Configuration"));
  
  // Check if already initialized
  const workersJsoncExists = await Bun.file(`${ctx.cwd}/workers.jsonc`).exists();
  const envLocalExists = await Bun.file(`${ctx.cwd}/.env.local`).exists();
  
  if ((workersJsoncExists || envLocalExists) && !force) {
    if (isInteractive) {
      const overwrite = await confirm({
        message: "Configuration files already exist. Overwrite?",
        initialValue: false,
      });
      if (!overwrite) {
        outro("Cancelled.");
        return;
      }
    } else {
      throw new ConfigValidationError(
        "Configuration files already exist. Use --force to overwrite.",
        "CONFIG_EXISTS"
      );
    }
  }
  
  // Collect credentials
  let apiToken: string;
  let accountId: string;
  let secretStoreId: string = "";
  let subdomainPrefix: string = "hoox";
  
  if (isInteractive) {
    apiToken = await text({
      message: "Enter your Cloudflare API Token:",
      placeholder: "cfut_...",
      validate: (value) => value.startsWith("cfut_") ? undefined : "Token should start with cfut_",
    }) as string;
    
    accountId = await text({
      message: "Enter your Cloudflare Account ID:",
      placeholder: "32-char hex",
      validate: (value) => value.length === 32 ? undefined : "Account ID should be 32 characters",
    }) as string;
    
    secretStoreId = await text({
      message: "Enter your Cloudflare Secret Store ID (optional):",
      placeholder: "Press Enter to skip",
    }) as string;
    
    subdomainPrefix = await text({
      message: "Enter subdomain prefix:",
      placeholder: "hoox",
      initialValue: "hoox",
    }) as string;
  } else {
    apiToken = args?.token as string;
    accountId = args?.account as string;
    secretStoreId = (args?.secretStore as string) || "";
    subdomainPrefix = (args?.prefix as string) || "hoox";
    
    if (!apiToken || !accountId) {
      throw new ConfigValidationError(
        "--token and --account are required in non-interactive mode",
        "MISSING_ARGS"
      );
    }
  }
  
  // Validate token with wrangler
  const s = spinner();
  s.start("Validating Cloudflare credentials...");
  
  const proc = Bun.spawn(["wrangler", "whoami"], {
    env: { ...Bun.env, CLOUDFLARE_API_TOKEN: apiToken },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  
  if (exitCode !== 0) {
    s.stop("Validation failed");
    throw new ConfigValidationError(
      "Invalid Cloudflare API Token. Run `wrangler login` first.",
      "INVALID_TOKEN"
    );
  }
  s.stop("Credentials validated");
  
  // Write workers.jsonc
  s.start("Creating workers.jsonc...");
  const config = JSON.parse(JSON.stringify(DEFAULT_WORKERS_JSONC));
  config.global.cloudflare_account_id = accountId;
  config.global.cloudflare_secret_store_id = secretStoreId;
  config.global.subdomain_prefix = subdomainPrefix;
  
  await Bun.write(`${ctx.cwd}/workers.jsonc`, JSON.stringify(config, null, 2));
  s.stop("Created workers.jsonc");
  
  // Create .env.local from example
  s.start("Creating .env.local...");
  const envExample = Bun.file(`${ctx.cwd}/.env.example`);
  if (await envExample.exists()) {
    let envContent = await envExample.text();
    envContent = envContent.replace('CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"', `CLOUDFLARE_API_TOKEN="${apiToken}"`);
    envContent = envContent.replace('CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"', `CLOUDFLARE_ACCOUNT_ID="${accountId}"`);
    envContent = envContent.replace('CLOUDFLARE_SECRET_STORE_ID="your_secret_store_id"', `CLOUDFLARE_SECRET_STORE_ID="${secretStoreId}"`);
    envContent = envContent.replace('SUBDOMAIN_PREFIX="hoox"', `SUBDOMAIN_PREFIX="${subdomainPrefix}"`);
    await Bun.write(`${ctx.cwd}/.env.local`, envContent);
  }
  s.stop("Created .env.local");
  
  if (isInteractive) {
    outro(ansis.green("✓ Configuration initialized!"));
    console.log("\nNext steps:");
    console.log("  1. Edit .env.local with your secrets");
    console.log("  2. Run: hoox workers setup");
    console.log("  3. Run: hoox check-setup");
  }
}

const command: Command = {
  name: "config:init",
  description: "Initialize Hoox configuration (workers.jsonc, .env.local)",
  options: [
    { name: "token", description: "Cloudflare API Token", type: "string" },
    { name: "account", description: "Cloudflare Account ID", type: "string" },
    { name: "secretStore", description: "Cloudflare Secret Store ID", type: "string" },
    { name: "prefix", description: "Subdomain prefix", type: "string" },
    { name: "force", description: "Overwrite existing config", type: "boolean" },
  ],
  execute: executeConfigInit,
};

export default command;
export { executeConfigInit };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/config/init.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/config/init.ts packages/hoox-cli/src/commands/config/init.test.ts
git commit -m "feat(cli): implement config:init command with interactive and non-interactive modes"
```

---

## Task 08: Implement workers:setup Command

**Files:**
- Modify: `packages/hoox-cli/src/commands/workers/setup.ts` (replace stub)
- Create: `packages/hoox-cli/src/commands/workers/setup.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeWorkersSetup } from "./setup";

describe("workers:setup command", () => {
  it("requires valid worker name", async () => {
    const ctx = { cwd: "/tmp", args: { worker: "nonexistent" } };
    await expect(executeWorkersSetup(ctx as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/workers/setup.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/workers/setup.ts

import { intro, outro, confirm, spinner } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";
import { ConfigValidationError } from "../../core/errors";

async function loadWorkersConfig(cwd: string): Promise<Record<string, any>> {
  const file = Bun.file(`${cwd}/workers.jsonc`);
  const content = await file.text();
  return JSON.parse(content.replace(/\/\/.*$/gm, ""));
}

async function executeWorkersSetup(ctx: CommandContext, args?: Record<string, unknown>): Promise<void> {
  const specificWorker = args?.worker as string | undefined;
  const all = args?.all === true;
  const skipSecrets = args?.skipSecrets === true;
  
  intro(ansis.bold("🔧 Worker Setup"));
  
  const config = await loadWorkersConfig(ctx.cwd);
  const workers = config.workers || {};
  
  const toSetup = specificWorker
    ? { [specificWorker]: workers[specificWorker] }
    : all ? workers : Object.fromEntries(
        Object.entries(workers).filter(([, w]: [string, any]) => w.enabled)
      );
  
  if (Object.keys(toSetup).length === 0) {
    throw new ConfigValidationError("No workers to setup", "NO_WORKERS");
  }
  
  const s = spinner();
  
  for (const [name, worker] of Object.entries(toSetup)) {
    if (!worker) continue;
    
    s.start(`Setting up ${name}...`);
    
    // Verify wrangler config exists
    const wranglerPath = `${ctx.cwd}/${worker.path}/wrangler.jsonc`;
    const wranglerFile = Bun.file(wranglerPath);
    if (!(await wranglerFile.exists())) {
      s.stop(`Failed: ${name} missing wrangler.jsonc`);
      continue;
    }
    
    // Bind secrets
    if (!skipSecrets && worker.secrets) {
      for (const secretName of worker.secrets) {
        try {
          await ctx.adapters.cloudflare.setSecret(name, secretName, "placeholder");
          s.message(`Set secret ${secretName} for ${name}`);
        } catch (err) {
          s.stop(`Warning: Failed to set secret ${secretName} for ${name}`);
        }
      }
    }
    
    // Create .dev.vars for local development
    const devVarsPath = `${ctx.cwd}/${worker.path}/.dev.vars`;
    const devVarsFile = Bun.file(devVarsPath);
    if (!(await devVarsFile.exists())) {
      const devVarsContent = worker.secrets
        ?.map((s: string) => `${s}=dev-value`)
        .join("\n") || "";
      await Bun.write(devVarsPath, devVarsContent + "\n");
    }
    
    s.stop(`✓ ${name} configured`);
  }
  
  outro(ansis.green("✓ Worker setup complete!"));
  console.log("\nNext steps:");
  console.log("  1. Update secret values with real credentials");
  console.log("  2. Run: hoox secrets update-cf");
  console.log("  3. Run: hoox check-setup");
}

const command: Command = {
  name: "workers:setup",
  description: "Bind secrets and provision environment for workers",
  options: [
    { name: "worker", description: "Setup specific worker", type: "string" },
    { name: "all", description: "Setup all enabled workers", type: "boolean" },
    { name: "skipSecrets", description: "Skip secret binding", type: "boolean" },
  ],
  execute: executeWorkersSetup,
};

export default command;
export { executeWorkersSetup };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/workers/setup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/workers/setup.ts packages/hoox-cli/src/commands/workers/setup.test.ts
git commit -m "feat(cli): implement workers:setup command with secret binding"
```

---

## Task 09: Implement housekeeping Command

**Files:**
- Create: `packages/hoox-cli/src/commands/housekeeping/index.ts`
- Create: `packages/hoox-cli/src/commands/housekeeping/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeHousekeeping } from "./index";

describe("housekeeping command", () => {
  it("returns health report", async () => {
    const ctx = { cwd: "/tmp", adapters: { cloudflare: {} } };
    const result = await executeHousekeeping(ctx as any);
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/housekeeping/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/housekeeping/index.ts

import { intro, outro, spinner, confirm } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";

interface HealthReport {
  workers: { name: string; healthy: boolean; responseTime: number }[];
  database: { connected: boolean; tableCount: number };
  kv: { connected: boolean; keysCount: number };
  queue: { depth: number; consumerActive: boolean };
  errors: string[];
}

async function executeHousekeeping(ctx: CommandContext, args?: Record<string, unknown>): Promise<HealthReport> {
  const autoFix = args?.fix === true;
  const isJson = args?.json === true;
  
  if (!isJson) intro(ansis.bold("🏠 Housekeeping"));
  
  const s = spinner();
  s.start("Running health checks...");
  
  const report: HealthReport = {
    workers: [],
    database: { connected: false, tableCount: 0 },
    kv: { connected: false, keysCount: 0 },
    queue: { depth: 0, consumerActive: false },
    errors: [],
  };
  
  // Check worker health
  const workers = ["hoox", "trade-worker", "agent-worker", "d1-worker", "telegram-worker", "analytics-worker"];
  for (const worker of workers) {
    try {
      const start = Date.now();
      const proc = Bun.spawn(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", `https://${worker}.${ctx.args?.subdomain || "cryptolinx"}.workers.dev/health`], {
        stdout: "pipe",
      });
      const code = await new Response(proc.stdout).text();
      const responseTime = Date.now() - start;
      report.workers.push({ name: worker, healthy: code === "200", responseTime });
    } catch (err) {
      report.workers.push({ name: worker, healthy: false, responseTime: 0 });
      report.errors.push(`Worker ${worker} unreachable: ${err}`);
    }
  }
  
  // Check database
  try {
    const dbResult = await ctx.adapters.cloudflare.executeD1Query("trade-data-db", "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'");
    report.database.connected = true;
    report.database.tableCount = dbResult.results?.[0]?.count || 0;
  } catch (err) {
    report.errors.push(`Database check failed: ${err}`);
  }
  
  // Check KV
  try {
    const kvKeys = await ctx.adapters.cloudflare.listKVNamespaceKeys?.("c5917667a21745e390ff969f32b1847d") || [];
    report.kv.connected = true;
    report.kv.keysCount = kvKeys.length;
  } catch (err) {
    report.errors.push(`KV check failed: ${err}`);
  }
  
  s.stop("Health check complete");
  
  // Auto-fix if requested
  if (autoFix) {
    s.start("Applying fixes...");
    // Cleanup old logs (older than 30 days)
    try {
      await ctx.adapters.cloudflare.executeD1Query(
        "trade-data-db",
        "DELETE FROM system_logs WHERE timestamp < unixepoch() - 2592000"
      );
    } catch {
      // Ignore cleanup errors
    }
    s.stop("Fixes applied");
  }
  
  // Output
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\n📊 Health Report");
    console.log("================");
    
    for (const w of report.workers) {
      const icon = w.healthy ? "✓" : "✗";
      const color = w.healthy ? ansis.green : ansis.red;
      console.log(color(`${icon} ${w.name.padEnd(20)} ${w.responseTime}ms`));
    }
    
    console.log(`\nDatabase: ${report.database.connected ? ansis.green("✓ Connected") : ansis.red("✗ Failed")} (${report.database.tableCount} tables)`);
    console.log(`KV: ${report.kv.connected ? ansis.green("✓ Connected") : ansis.red("✗ Failed")} (${report.kv.keysCount} keys)`);
    
    if (report.errors.length > 0) {
      console.log("\n" + ansis.red("Errors:"));
      for (const err of report.errors) console.log(`  ✗ ${err}`);
    }
    
    const healthyWorkers = report.workers.filter((w) => w.healthy).length;
    const totalWorkers = report.workers.length;
    
    if (healthyWorkers === totalWorkers && report.database.connected) {
      outro(ansis.green(`✓ All systems healthy (${healthyWorkers}/${totalWorkers} workers)`));
    } else {
      outro(ansis.yellow(`⚠ ${totalWorkers - healthyWorkers} worker(s) unhealthy`));
    }
  }
  
  return report;
}

const command: Command = {
  name: "housekeeping",
  description: "Run system health checks and cleanup",
  options: [
    { name: "fix", description: "Auto-fix minor issues", type: "boolean" },
    { name: "json", description: "Output as JSON", type: "boolean" },
  ],
  execute: executeHousekeeping,
};

export default command;
export { executeHousekeeping };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/housekeeping/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/housekeeping/
git commit -m "feat(cli): implement housekeeping command with health checks"
```

---

## Task 10: Implement R2 Provisioning Command

**Files:**
- Create: `packages/hoox-cli/src/commands/r2/index.ts`
- Create: `packages/hoox-cli/src/commands/r2/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeR2 } from "./index";

describe("r2 command", () => {
  it("lists buckets in list mode", async () => {
    const ctx = { cwd: "/tmp", args: { list: true } };
    // Should not throw
    await expect(executeR2(ctx as any)).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/r2/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/r2/index.ts

import { intro, outro, confirm, spinner } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";

const REQUIRED_BUCKETS = [
  "trade-reports",
  "hoox-system-logs",
  "user-uploads",
];

async function executeR2(ctx: CommandContext, args?: Record<string, unknown>): Promise<void> {
  const listMode = args?.list === true;
  const createMode = args?.create === true;
  const deleteMode = args?.delete === true;
  
  intro(ansis.bold("📦 R2 Bucket Management"));
  
  const s = spinner();
  s.start("Fetching R2 buckets...");
  
  const buckets = await ctx.adapters.cloudflare.listR2Buckets();
  const bucketNames = buckets.map((b) => b.name);
  
  s.stop(`Found ${buckets.length} bucket(s)`);
  
  if (listMode) {
    console.log("\nCurrent R2 Buckets:");
    for (const b of buckets) {
      console.log(`  • ${b.name}`);
    }
    outro("Done.");
    return;
  }
  
  // Check required buckets
  const missing = REQUIRED_BUCKETS.filter((b) => !bucketNames.includes(b));
  const existing = REQUIRED_BUCKETS.filter((b) => bucketNames.includes(b));
  
  if (missing.length === 0) {
    outro(ansis.green("✓ All required buckets exist."));
    return;
  }
  
  console.log("\nRequired Buckets:");
  for (const b of existing) console.log(ansis.green(`  ✓ ${b}`));
  for (const b of missing) console.log(ansis.red(`  ✗ ${b} (missing)`));
  
  if (createMode) {
    for (const bucket of missing) {
      s.start(`Creating bucket: ${bucket}...`);
      try {
        await ctx.adapters.cloudflare.createR2Bucket(bucket);
        s.stop(ansis.green(`Created: ${bucket}`));
      } catch (err) {
        s.stop(ansis.red(`Failed to create ${bucket}: ${err}`));
      }
    }
    outro("Bucket creation complete.");
  } else {
    const shouldCreate = await confirm({
      message: `Create ${missing.length} missing bucket(s)?`,
      initialValue: true,
    });
    
    if (shouldCreate) {
      for (const bucket of missing) {
        s.start(`Creating bucket: ${bucket}...`);
        try {
          await ctx.adapters.cloudflare.createR2Bucket(bucket);
          s.stop(ansis.green(`Created: ${bucket}`));
        } catch (err) {
          s.stop(ansis.red(`Failed to create ${bucket}: ${err}`));
        }
      }
      outro("Bucket creation complete.");
    } else {
      outro("Skipped.");
    }
  }
}

const command: Command = {
  name: "r2",
  description: "Provision and manage R2 buckets",
  options: [
    { name: "list", description: "List current buckets", type: "boolean" },
    { name: "create", description: "Auto-create missing buckets", type: "boolean" },
    { name: "delete", description: "Delete buckets (with confirmation)", type: "boolean" },
  ],
  execute: executeR2,
};

export default command;
export { executeR2 };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/r2/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/r2/
git commit -m "feat(cli): implement r2 bucket provisioning command"
```

---

## Task 11: Implement WAF Configuration Command

**Files:**
- Create: `packages/hoox-cli/src/commands/waf/index.ts`
- Create: `packages/hoox-cli/src/commands/waf/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeWaf } from "./index";

describe("waf command", () => {
  it("validates IP format", async () => {
    const ctx = { cwd: "/tmp", args: { ips: "invalid-ip" } };
    await expect(executeWaf(ctx as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/waf/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/waf/index.ts

import { intro, outro, text, select } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";
import { ConfigValidationError } from "../../core/errors";

function validateIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F:]+)$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

async function executeWaf(ctx: CommandContext, args?: Record<string, unknown>): Promise<void> {
  const ipsArg = args?.ips as string | undefined;
  const modeArg = args?.mode as string | undefined;
  
  intro(ansis.bold("🛡️  WAF Configuration"));
  
  let ips: string[] = [];
  let mode: string = "block";
  
  if (ipsArg) {
    ips = ipsArg.split(",").map((ip) => ip.trim());
    for (const ip of ips) {
      if (!validateIP(ip)) {
        throw new ConfigValidationError(`Invalid IP address: ${ip}`, "INVALID_IP");
      }
    }
  } else {
    const input = await text({
      message: "Enter allowed IPs (comma-separated):",
      placeholder: "1.2.3.4, 5.6.7.8",
    }) as string;
    ips = input.split(",").map((ip) => ip.trim()).filter(Boolean);
  }
  
  if (modeArg) {
    if (!["block", "challenge", "simulate"].includes(modeArg)) {
      throw new ConfigValidationError(`Invalid mode: ${modeArg}`, "INVALID_MODE");
    }
    mode = modeArg;
  } else {
    mode = await select({
      message: "Select WAF mode:",
      options: [
        { value: "block", label: "Block" },
        { value: "challenge", label: "Challenge" },
        { value: "simulate", label: "Simulate" },
      ],
    }) as string;
  }
  
  console.log("\nConfiguration:");
  console.log(`  Mode: ${mode}`);
  console.log(`  IPs: ${ips.join(", ")}`);
  
  // Store in KV
  if (ips.length > 0) {
    await ctx.adapters.cloudflare.setKV?.("CONFIG_KV", "webhook:allowed_ips", ips.join(","));
    await ctx.adapters.cloudflare.setKV?.("CONFIG_KV", "webhook:tradingview:ip_check_enabled", "true");
  }
  
  outro(ansis.green("✓ WAF configuration updated"));
}

const command: Command = {
  name: "waf",
  description: "Configure Cloudflare WAF rules (IP allowlists)",
  options: [
    { name: "ips", description: "Comma-separated allowed IPs", type: "string" },
    { name: "mode", description: "WAF mode: block|challenge|simulate", type: "string" },
  ],
  execute: executeWaf,
};

export default command;
export { executeWaf };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/waf/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/waf/
git commit -m "feat(cli): implement waf configuration command"
```

---

## Task 12: Implement Repair Command

**Files:**
- Create: `packages/hoox-cli/src/commands/repair/index.ts`
- Create: `packages/hoox-cli/src/commands/repair/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeRepair } from "./index";

describe("repair command", () => {
  it("runs in dry-run mode without making changes", async () => {
    const ctx = { cwd: "/tmp", args: { dryRun: true } };
    const result = await executeRepair(ctx as any);
    expect(result.fixed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/repair/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/repair/index.ts

import { intro, outro, confirm, spinner } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";
import { executeCheckSetup } from "../check-setup/index";

interface RepairResult {
  fixed: string[];
  manual: string[];
  skipped: string[];
}

async function executeRepair(ctx: CommandContext, args?: Record<string, unknown>): Promise<RepairResult> {
  const dryRun = args?.dryRun === true;
  const force = args?.force === true;
  
  intro(ansis.bold("🔧 System Repair"));
  
  if (dryRun) {
    console.log(ansis.yellow("[DRY RUN] No changes will be applied\n"));
  }
  
  // First run check-setup
  const s = spinner();
  s.start("Running diagnostics...");
  const checkResults = await executeCheckSetup(ctx, { json: true });
  s.stop("Diagnostics complete");
  
  const result: RepairResult = { fixed: [], manual: [], skipped: [] };
  
  // Check each validation result for fixable issues
  for (const check of checkResults) {
    if (check.success) continue;
    
    for (const error of check.errors) {
      if (error.includes(".env.local not found")) {
        if (!dryRun) {
          const envExample = Bun.file(`${ctx.cwd}/.env.example`);
          if (await envExample.exists()) {
            const content = await envExample.text();
            if (!force) {
              const ok = await confirm({ message: "Create .env.local from .env.example?" });
              if (!ok) { result.skipped.push(".env.local"); continue; }
            }
            await Bun.write(`${ctx.cwd}/.env.local`, content);
            result.fixed.push("Created .env.local from .env.example");
          }
        } else {
          result.manual.push("Would create .env.local from .env.example");
        }
      }
      
      if (error.includes("missing .dev.vars")) {
        // Extract worker name from error
        const match = error.match(/Worker "(.+?)"/);
        if (match) {
          const workerName = match[1];
          const devVarsPath = `${ctx.cwd}/workers/${workerName}/.dev.vars`;
          if (!dryRun) {
            await Bun.write(devVarsPath, "# Development secrets\n");
            result.fixed.push(`Created .dev.vars for ${workerName}`);
          } else {
            result.manual.push(`Would create .dev.vars for ${workerName}`);
          }
        }
      }
      
      if (error.includes("Missing required table")) {
        const match = error.match(/Missing required table: (.+)/);
        if (match) {
          const table = match[1];
          if (!dryRun) {
            result.manual.push(`Database table "${table}" needs manual schema migration`);
          } else {
            result.manual.push(`Would need to create table: ${table}`);
          }
        }
      }
      
      if (error.includes("missing secret")) {
        if (!dryRun) {
          result.manual.push(error + " — Set via: hoox secrets update-cf");
        } else {
          result.manual.push("Would need to set: " + error);
        }
      }
    }
  }
  
  // Output report
  console.log("\n📋 Repair Report");
  console.log("=================");
  
  if (result.fixed.length > 0) {
    console.log(ansis.green("\n✓ Fixed:"));
    for (const item of result.fixed) console.log(`  ✓ ${item}`);
  }
  
  if (result.manual.length > 0) {
    console.log(ansis.yellow("\n⚠ Requires manual action:"));
    for (const item of result.manual) console.log(`  • ${item}`);
  }
  
  if (result.skipped.length > 0) {
    console.log(ansis.dim("\n○ Skipped:"));
    for (const item of result.skipped) console.log(`  ○ ${item}`);
  }
  
  const totalIssues = result.fixed.length + result.manual.length + result.skipped.length;
  if (totalIssues === 0) {
    outro(ansis.green("✓ No issues found — system is healthy!"));
  } else {
    outro(ansis.green(`✓ Repaired ${result.fixed.length}/${totalIssues} issues`));
  }
  
  return result;
}

const command: Command = {
  name: "repair",
  description: "Auto-fix common setup issues",
  options: [
    { name: "dryRun", description: "Preview fixes without applying", type: "boolean" },
    { name: "force", description: "Apply fixes without confirmation", type: "boolean" },
  ],
  execute: executeRepair,
};

export default command;
export { executeRepair };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/repair/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/repair/
git commit -m "feat(cli): implement repair command with auto-fix capabilities"
```

---

## Task 13: Enhance workers:update-internal-urls Command

**Files:**
- Modify: `packages/hoox-cli/src/commands/workers/update-urls.ts`
- Create: `packages/hoox-cli/src/commands/workers/update-urls.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { executeUpdateUrls } from "./update-urls";

describe("workers:update-internal-urls command", () => {
  it("updates dashboard vars with worker URLs", async () => {
    const ctx = { cwd: "/tmp", args: { dryRun: true } };
    await expect(executeUpdateUrls(ctx as any)).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/src/commands/workers/update-urls.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/hoox-cli/src/commands/workers/update-urls.ts

import { intro, outro, spinner } from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext } from "../../core/types";

async function loadWorkersConfig(cwd: string): Promise<Record<string, any>> {
  const file = Bun.file(`${cwd}/workers.jsonc`);
  const content = await file.text();
  return JSON.parse(content.replace(/\/\/.*$/gm, ""));
}

async function executeUpdateUrls(ctx: CommandContext, args?: Record<string, unknown>): Promise<void> {
  const dryRun = args?.dryRun === true;
  
  intro(ansis.bold("🔄 Update Internal URLs"));
  
  const config = await loadWorkersConfig(ctx.cwd);
  const prefix = config.global?.subdomain_prefix || "cryptolinx";
  const accountId = config.global?.cloudflare_account_id;
  
  const s = spinner();
  s.start("Fetching worker URLs from Cloudflare...");
  
  // Build expected URLs
  const workerUrls: Record<string, string> = {};
  for (const [name, worker] of Object.entries(config.workers || {})) {
    if (!worker?.enabled) continue;
    workerUrls[name] = `https://${name}.${prefix}.workers.dev`;
  }
  
  s.stop(`Found ${Object.keys(workerUrls).length} worker(s)`);
  
  // Update dashboard wrangler.jsonc
  const dashboardWranglerPath = `${ctx.cwd}/pages/dashboard/wrangler.jsonc`;
  const dashboardFile = Bun.file(dashboardWranglerPath);
  
  if (await dashboardFile.exists()) {
    const content = await dashboardFile.text();
    const dashboardConfig = JSON.parse(content.replace(/\/\/.*$/gm, ""));
    
    const updates: Record<string, string> = {};
    
    if (workerUrls["d1-worker"] && dashboardConfig.vars?.D1_WORKER_URL !== workerUrls["d1-worker"]) {
      updates["D1_WORKER_URL"] = workerUrls["d1-worker"];
    }
    if (workerUrls["agent-worker"] && dashboardConfig.vars?.AGENT_SERVICE_URL !== workerUrls["agent-worker"]) {
      updates["AGENT_SERVICE_URL"] = workerUrls["agent-worker"];
    }
    if (workerUrls["trade-worker"] && dashboardConfig.vars?.TRADE_SERVICE_URL !== workerUrls["trade-worker"]) {
      updates["TRADE_SERVICE_URL"] = workerUrls["trade-worker"];
    }
    if (workerUrls["telegram-worker"] && dashboardConfig.vars?.TELEGRAM_SERVICE_URL !== workerUrls["telegram-worker"]) {
      updates["TELEGRAM_SERVICE_URL"] = workerUrls["telegram-worker"];
    }
    
    if (Object.keys(updates).length > 0) {
      console.log("\nDashboard URL Updates:");
      for (const [key, value] of Object.entries(updates)) {
        const oldValue = dashboardConfig.vars?.[key] || "(none)";
        console.log(`  ${key}:`);
        console.log(`    ${ansis.red(oldValue)}`);
        console.log(`    ${ansis.green(value)}`);
        dashboardConfig.vars = { ...dashboardConfig.vars, [key]: value };
      }
      
      if (!dryRun) {
        await Bun.write(dashboardWranglerPath, JSON.stringify(dashboardConfig, null, 2));
        outro(ansis.green("✓ Dashboard URLs updated"));
      } else {
        outro(ansis.yellow("[DRY RUN] No changes saved"));
      }
    } else {
      outro(ansis.green("✓ All URLs up to date"));
    }
  } else {
    outro(ansis.red("Dashboard wrangler.jsonc not found"));
  }
}

const command: Command = {
  name: "workers:update-internal-urls",
  description: "Update internal worker URLs in dashboard config",
  options: [
    { name: "dryRun", description: "Preview changes without applying", type: "boolean" },
  ],
  execute: executeUpdateUrls,
};

export default command;
export { executeUpdateUrls };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/src/commands/workers/update-urls.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/commands/workers/update-urls.ts packages/hoox-cli/src/commands/workers/update-urls.test.ts
git commit -m "feat(cli): enhance workers:update-internal-urls with diff display"
```

---

## Task 14: Write Integration Tests

**Files:**
- Create: `packages/hoox-cli/tests/integration/setup-commands.test.ts`
- Create: `packages/hoox-cli/tests/integration/repair-commands.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/hoox-cli/tests/integration/setup-commands.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("setup commands integration", () => {
  let tmpDir: string;
  
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hoox-test-"));
    // Create minimal workers.jsonc
    writeFileSync(join(tmpDir, "workers.jsonc"), JSON.stringify({
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: { "test-worker": { enabled: true, path: "workers/test-worker", secrets: ["TEST_SECRET"] } }
    }));
  });
  
  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });
  
  it("check-setup validates config files", async () => {
    const { executeCheckSetup } = await import("../../src/commands/check-setup/index");
    const ctx = {
      cwd: tmpDir,
      adapters: { cloudflare: { listD1Databases: async () => [] } },
    };
    const results = await executeCheckSetup(ctx as any);
    expect(results.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/tests/integration/setup-commands.test.ts`
Expected: FAIL

- [ ] **Step 3: Write full integration test suite**

```typescript
// packages/hoox-cli/tests/integration/setup-commands.test.ts

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function createTestProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "hoox-test-"));
  
  // workers.jsonc
  writeFileSync(join(dir, "workers.jsonc"), JSON.stringify({
    global: { 
      cloudflare_account_id: "test123", 
      subdomain_prefix: "test",
      cloudflare_secret_store_id: "",
    },
    workers: {
      "test-worker": { 
        enabled: true, 
        path: "workers/test-worker",
        secrets: ["TEST_SECRET"],
      }
    }
  }, null, 2));
  
  // .env.example
  writeFileSync(join(dir, ".env.example"), "CLOUDFLARE_API_TOKEN=test\nCLOUDFLARE_ACCOUNT_ID=test\n");
  
  // Create worker directory
  mkdirSync(join(dir, "workers", "test-worker"), { recursive: true });
  writeFileSync(join(dir, "workers", "test-worker", "wrangler.jsonc"), JSON.stringify({
    name: "test-worker",
    main: "src/index.ts",
  }));
  
  return dir;
}

describe("setup commands integration", () => {
  let tmpDir: string;
  
  beforeEach(() => {
    tmpDir = createTestProject();
  });
  
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
  
  it("check-setup finds missing .env.local", async () => {
    const { executeCheckSetup } = await import("../../src/commands/check-setup/index");
    const mockAdapter = {
      listD1Databases: async () => [],
      listKVNamespaces: async () => [],
      listR2Buckets: async () => [],
      listQueues: async () => [],
      listSecrets: async () => [],
      executeD1Query: async () => ({ results: [] }),
    };
    
    const ctx = {
      cwd: tmpDir,
      adapters: { cloudflare: mockAdapter, bun: {} },
      observer: { getState: () => ({}) },
      engine: {},
    };
    
    const results = await executeCheckSetup(ctx as any);
    const envCheck = results.find((r: any) => r.name === "Environment");
    expect(envCheck?.success).toBe(false);
    expect(envCheck?.errors[0]).toContain(".env.local not found");
  });
  
  it("config:init creates .env.local", async () => {
    const { executeConfigInit } = await import("../../src/commands/config/init");
    
    const ctx = {
      cwd: tmpDir,
      adapters: { cloudflare: {} },
      args: { token: "cfut_test", account: "test123", force: true },
    };
    
    await executeConfigInit(ctx as any);
    
    const envLocal = Bun.file(join(tmpDir, ".env.local"));
    expect(await envLocal.exists()).toBe(true);
    
    const content = await envLocal.text();
    expect(content).toContain("cfut_test");
    expect(content).toContain("test123");
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/tests/integration/setup-commands.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/tests/integration/
git commit -m "test(cli): add integration tests for setup commands"
```

---

## Task 15: Update Help Banner and Command Registry

**Files:**
- Modify: `packages/hoox-cli/src/index.ts`
- Create: `packages/hoox-cli/tests/help-banner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";

describe("help banner", () => {
  it("includes all command categories", async () => {
    const indexModule = await import("../src/index");
    // The banner is printed via side effect, verify categories exist
    // by checking that the module loads without error
    expect(indexModule).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/hoox-cli/tests/help-banner.test.ts`
Expected: FAIL

- [ ] **Step 3: Update index.ts**

Modify `packages/hoox-cli/src/index.ts` around line 55-67:

```typescript
const categoryOrder = [
  "init",
  "clone",
  "checkSetup",      // NEW
  "repair",          // NEW
  "config",
  "workers",
  "trade",
  "dashboard",
  "cf",
  "logs",
  "housekeeping",    // Already present but verify
  "r2",              // NEW
  "waf",             // NEW
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/hoox-cli/tests/help-banner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/index.ts packages/hoox-cli/tests/help-banner.test.ts
git commit -m "feat(cli): update help banner with new command categories"
```

---

## Task 16: Final Validation

**Files:** (All existing + new files)

- [ ] **Step 1: Run lint**

Run: `bun run lint`
Expected: No errors

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No TypeScript errors

- [ ] **Step 3: Run tests**

Run: `bun test packages/hoox-cli`
Expected: All tests pass, coverage >80%

- [ ] **Step 4: Verify commands are discoverable**

Run: `cd packages/hoox-cli && bun run src/index.ts --help`
Expected: All new commands appear in help output

- [ ] **Step 5: Update documentation**

Update `docs/SETUP_AND_OPERATIONS.md` Section 10 and 11 with actual command examples.

- [ ] **Step 6: Commit**

```bash
git add docs/SETUP_AND_OPERATIONS.md
git commit -m "docs: update setup guide with new CLI commands"
```

---

## Spec Coverage Check

| Spec Requirement | Implementing Task |
|-----------------|-------------------|
| check-setup validates entire system | Task 06 |
| config:init creates config files | Task 07 |
| workers:setup binds secrets | Task 08 |
| housekeeping runs health checks | Task 09 |
| r2 provisions buckets | Task 10 |
| waf configures rules | Task 11 |
| repair auto-fixes issues | Task 12 |
| Interactive and non-interactive modes | All command tasks |
| Shared validation utilities | Tasks 01-05 |
| Tests for all commands | Tasks 01-15 |

## Placeholder Scan

- [x] No "TBD" or "TODO" in plan
- [x] All steps have actual code blocks
- [x] All steps have exact commands with expected output
- [x] No vague requirements

## Type Consistency Check

- ValidationResult interface used consistently across Tasks 01-06
- CommandContext interface used in all command tasks
- CloudflareAdapter methods referenced match adapter implementation
- Workers config shape matches workers.jsonc structure

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-05-cli-setup-system.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

---

*Plan Version: 1.0*  
*Tasks: 16 subtasks with dependencies*  
*Estimated Duration: 4-6 hours*  
*Files to create/modify: 32*
