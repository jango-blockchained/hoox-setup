# Worker Manifest Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a canonical `WorkerManifest` schema in `packages/shared/src/schemas/` that defines the expected configuration for all 9 workers, with validators and generators the CLI can use to validate, generate, and repair worker configs.

**Architecture:** Pure TypeScript types + static registry data in `packages/shared` (no worker runtime deps). CLI subcommand orchestrates validation/generation by comparing manifests against actual wrangler.jsonc files.

**Tech Stack:** TypeScript (strict), jsonc-parser (already in deps), Commander (already in CLI)

---

### Task 1: Create `types.ts` — WorkerManifest and supporting types

**Files:**

- Create: `packages/shared/src/schemas/types.ts`

- [ ] **Step 1: Write the types file**

Content:

```typescript
/**
 * Worker Manifest Schema — canonical definition of what each worker expects.
 */

export interface WorkerManifest {
  /** Worker name (e.g. "trade-worker") */
  name: string;
  /** Path relative to project root (e.g. "workers/trade-worker") */
  path: string;
  /** Vars the worker declares in its wrangler.jsonc `vars` section */
  vars: Record<string, VarDef>;
  /** Service bindings this worker calls */
  services: ServiceBindingDef[];
  /** Infrastructure bindings this worker needs */
  infrastructure: InfraBindings;
  /** Middleware this worker imports from @jango-blockchained/hoox-shared */
  middleware: string[];
  /** Cron triggers (empty array = none) */
  cron?: string[];
}

export interface VarDef {
  type: "secret" | "plaintext";
  description: string;
  /** Default value for plaintext vars (optional) */
  default?: string;
}

export interface ServiceBindingDef {
  binding: string;
  service: string;
  description: string;
}

export interface InfraBindings {
  kv?: KVBindingDef[];
  d1?: D1BindingDef[];
  r2?: R2BindingDef[];
  queues?: QueueBindingDef;
  ai?: boolean;
  vectorize?: VectorizeBindingDef[];
  analyticsEngine?: boolean;
  durableObjects?: DOBindingDef[];
  browser?: boolean;
}

export interface KVBindingDef {
  binding: string;
  description: string;
}

export interface D1BindingDef {
  binding: string;
  database: string;
  description?: string;
}

export interface R2BindingDef {
  binding: string;
  bucket: string;
  description?: string;
}

export interface QueueBindingDef {
  producer?: string[];
  consumer?: string[];
}

export interface VectorizeBindingDef {
  binding: string;
  index: string;
}

export interface DOBindingDef {
  name: string;
  className: string;
}

export interface ValidationError {
  worker: string;
  severity: "error" | "warning";
  message: string;
  file?: string;
}

export interface ValidationReport {
  worker: string;
  passed: boolean;
  errors: ValidationError[];
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/schemas/types.ts
git commit -m "feat(schemas): add WorkerManifest and supporting types"
```

---

### Task 2: Create `registry.ts` — all 9 worker manifests + `deriveCalledBy()`

**Files:**

- Create: `packages/shared/src/schemas/registry.ts`

- [ ] **Step 1: Write the registry with all 9 worker manifests**

The `deriveCalledBy()` function computes reverse mappings at export time by inverting `services` fields across all manifests.

```typescript
import type { WorkerManifest, ServiceBindingDef } from "./types.js";

/**
 * Compute reverse service binding mapping.
 * Returns a map of worker-name -> list-of-workers-that-call-it.
 */
function deriveCalledBy(
  manifests: Record<string, WorkerManifest>
): Record<string, string[]> {
  const calledBy: Record<string, Set<string>> = {};
  for (const [workerName, manifest] of Object.entries(manifests)) {
    if (!calledBy[workerName]) calledBy[workerName] = new Set();
    for (const svc of manifest.services) {
      if (!calledBy[svc.service]) calledBy[svc.service] = new Set();
      calledBy[svc.service].add(workerName);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [worker, callers] of Object.entries(calledBy)) {
    result[worker] = [...callers].sort();
  }
  return result;
}

const manifests: Record<string, WorkerManifest> = {
  hoox: {
    name: "hoox",
    path: "workers/hoox",
    vars: {
      WEBHOOK_API_KEY_BINDING: {
        type: "secret",
        description: "External webhook auth key",
      },
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      HA_TOKEN_BINDING: { type: "secret", description: "Home Assistant token" },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Trading functionality",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      kv: [
        { binding: "SESSIONS_KV", description: "Webhook session storage" },
        {
          binding: "CONFIG_KV",
          description: "Configuration + rate limiter state",
        },
      ],
      vectorize: [{ binding: "VECTORIZE_INDEX", index: "my-rag-index" }],
      ai: true,
      queues: { producer: ["trade-execution"] },
      durableObjects: [
        { name: "IDEMPOTENCY_STORE", className: "IdempotencyStore" },
      ],
    },
    middleware: [
      "requireAuth",
      "requireInternalAuth",
      "cors",
      "rateLimit",
      "logger",
      "validate",
    ],
  },

  "trade-worker": {
    name: "trade-worker",
    path: "workers/trade-worker",
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      TELEGRAM_INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Telegram outbound auth",
      },
      BINANCE_KEY_BINDING: { type: "secret", description: "Binance API key" },
      BINANCE_SECRET_BINDING: {
        type: "secret",
        description: "Binance API secret",
      },
      MEXC_KEY_BINDING: { type: "secret", description: "MEXC API key" },
      MEXC_SECRET_BINDING: { type: "secret", description: "MEXC API secret" },
      BYBIT_KEY_BINDING: { type: "secret", description: "Bybit API key" },
      BYBIT_SECRET_BINDING: { type: "secret", description: "Bybit API secret" },
    },
    services: [
      {
        binding: "D1_SERVICE",
        service: "d1-worker",
        description: "Database operations",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      d1: [
        {
          binding: "DB",
          database: "trade-data-db",
          description: "Trade operations",
        },
      ],
      r2: [
        {
          binding: "REPORTS_BUCKET",
          bucket: "trade-reports",
          description: "Trade reports",
        },
        {
          binding: "SYSTEM_LOGS_BUCKET",
          bucket: "hoox-system-logs",
          description: "Verbose exchange logs",
        },
      ],
      queues: { consumer: ["trade-execution"] },
    },
    middleware: ["requireInternalAuth"],
  },

  "telegram-worker": {
    name: "telegram-worker",
    path: "workers/telegram-worker",
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      TG_BOT_TOKEN_BINDING: {
        type: "secret",
        description: "Telegram bot token",
      },
      TG_CHAT_ID_BINDING: { type: "secret", description: "Default chat ID" },
      TELEGRAM_SECRET_TOKEN: {
        type: "secret",
        description: "Webhook verification token",
      },
    },
    services: [],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      r2: [
        {
          binding: "UPLOADS_BUCKET",
          bucket: "user-uploads",
          description: "User uploaded files",
        },
      ],
      vectorize: [{ binding: "VECTORIZE_INDEX", index: "my-rag-index" }],
      ai: true,
    },
    middleware: ["requireInternalAuth"],
  },

  "d1-worker": {
    name: "d1-worker",
    path: "workers/d1-worker",
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
    },
    services: [],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      d1: [
        {
          binding: "DB",
          database: "trade-data-db",
          description: "Main database",
        },
      ],
    },
    middleware: ["requireInternalAuth"],
  },

  "web3-wallet-worker": {
    name: "web3-wallet-worker",
    path: "workers/web3-wallet-worker",
    vars: {
      WALLET_PK_SECRET: { type: "secret", description: "Wallet private key" },
      WALLET_MNEMONIC_SECRET: {
        type: "secret",
        description: "Wallet mnemonic phrase",
      },
    },
    services: [
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {},
    middleware: ["requireInternalAuth"],
  },

  "agent-worker": {
    name: "agent-worker",
    path: "workers/agent-worker",
    vars: {
      AGENT_INTERNAL_KEY: { type: "secret", description: "Agent worker auth" },
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Trading functionality",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      d1: [
        {
          binding: "DB",
          database: "trade-data-db",
          description: "Portfolio queries",
        },
      ],
      ai: true,
    },
    middleware: ["requireInternalAuth"],
    cron: ["*/5 * * * *"],
  },

  "email-worker": {
    name: "email-worker",
    path: "workers/email-worker",
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      EMAIL_HOST_BINDING: { type: "secret", description: "Email IMAP host" },
      EMAIL_USER_BINDING: { type: "secret", description: "Email username" },
      EMAIL_PASS_BINDING: { type: "secret", description: "Email password" },
      TRADE_WORKER_NAME: {
        type: "plaintext",
        description: "Trade worker service name",
        default: "trade-worker",
      },
      USE_IMAP: {
        type: "plaintext",
        description: "Use IMAP for email",
        default: "false",
      },
      MAILGUN_API_KEY: { type: "secret", description: "Mailgun API key" },
      EMAIL_SCAN_SUBJECT: { type: "secret", description: "Email scan subject" },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Trading functionality",
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
    },
    middleware: ["requireInternalAuth"],
    cron: ["*/5 * * * *"],
  },

  "analytics-worker": {
    name: "analytics-worker",
    path: "workers/analytics-worker",
    vars: {
      CLOUDFLARE_API_TOKEN: {
        type: "secret",
        description: "CF API token for Analytics SQL",
      },
      CLOUDFLARE_ACCOUNT_ID: {
        type: "plaintext",
        description: "CF Account ID",
      },
    },
    services: [],
    infrastructure: {
      analyticsEngine: true,
    },
    middleware: [],
  },

  "report-worker": {
    name: "report-worker",
    path: "workers/report-worker",
    vars: {
      CF_API_TOKEN_BINDING: {
        type: "secret",
        description: "CF API token for Browser Rendering",
      },
      ACCOUNT_ID: { type: "plaintext", description: "CF Account ID" },
    },
    services: [
      {
        binding: "D1_SERVICE",
        service: "d1-worker",
        description: "Database queries",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      r2: [
        {
          binding: "REPORTS_BUCKET",
          bucket: "trade-reports",
          description: "PDF reports",
        },
      ],
    },
    middleware: ["requireInternalAuth"],
    cron: ["0 8 * * *", "0 18 * * *"],
  },

  dashboard: {
    name: "dashboard",
    path: "workers/dashboard",
    vars: {
      DASHBOARD_USER: {
        type: "secret",
        description: "Dashboard admin username",
      },
      DASHBOARD_PASS: {
        type: "secret",
        description: "Dashboard admin password",
      },
      SESSION_SECRET: { type: "secret", description: "Session encryption key" },
    },
    services: [
      {
        binding: "D1_SERVICE",
        service: "d1-worker",
        description: "Database queries",
      },
      {
        binding: "AGENT_SERVICE",
        service: "agent-worker",
        description: "AI risk data",
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      ai: true,
    },
    middleware: [],
  },
};

/** Map of worker-name -> list-of-workers-that-call-it (computed). */
export const CALLED_BY: Record<string, string[]> = deriveCalledBy(manifests);

/** The canonical registry of all worker manifests. */
export const WORKER_MANIFESTS: Record<string, WorkerManifest> = manifests;

/** List of all worker names in the registry. */
export const WORKER_NAMES: string[] = Object.keys(manifests).sort();
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/schemas/registry.ts
git commit -m "feat(schemas): add registry with all 9 worker manifests"
```

---

### Task 3: Create `validators.ts` — validate and generate functions

**Files:**

- Create: `packages/shared/src/schemas/validators.ts`

- [ ] **Step 1: Write the validateWranglerJsonc function**

```typescript
import { parse } from "jsonc-parser";
import type { WorkerManifest, ValidationError } from "./types.js";

/**
 * Validate a per-worker wrangler.jsonc against its manifest.
 * Returns an array of errors (empty = perfect match).
 */
export function validateWranglerJsonc(
  workerName: string,
  manifest: WorkerManifest,
  jsoncContent: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  let parsed: any;
  try {
    parsed = parse(jsoncContent);
  } catch {
    errors.push({
      worker: workerName,
      severity: "error",
      message: "Failed to parse wrangler.jsonc",
      file: "wrangler.jsonc",
    });
    return errors;
  }

  // Check vars
  const declaredVars = parsed?.vars ?? {};
  for (const [name, def] of Object.entries(manifest.vars)) {
    if (!(name in declaredVars)) {
      errors.push({
        worker: workerName,
        severity: "error",
        message: `Missing var: ${name} (${def.description})`,
        file: "wrangler.jsonc",
      });
    }
  }

  // Check naming convention for secret vars
  for (const [name, def] of Object.entries(manifest.vars)) {
    if (
      def.type === "secret" &&
      !name.endsWith("_BINDING") &&
      !name.endsWith("_SECRET") &&
      !name.startsWith("CLOUDFLARE_") &&
      name !== "TELEGRAM_SECRET_TOKEN" &&
      name !== "MAILGUN_API_KEY" &&
      name !== "EMAIL_SCAN_SUBJECT" &&
      name !== "DASHBOARD_USER" &&
      name !== "DASHBOARD_PASS" &&
      name !== "SESSION_SECRET" &&
      name !== "AGENT_INTERNAL_KEY"
    ) {
      errors.push({
        worker: workerName,
        severity: "warning",
        message: `Secret var "${name}" does not end with _BINDING or _SECRET suffix`,
        file: "wrangler.jsonc",
      });
    }
  }

  // Check services
  const declaredServices: Array<{ binding: string; service: string }> =
    parsed?.services ?? [];
  for (const expected of manifest.services) {
    const match = declaredServices.find(
      (s: any) =>
        s.binding === expected.binding && s.service === expected.service
    );
    if (!match) {
      const declared = declaredServices.find(
        (s: any) => s.binding === expected.binding
      );
      if (declared) {
        errors.push({
          worker: workerName,
          severity: "error",
          message: `Service "${expected.binding}" points to "${declared.service}" but manifest expects "${expected.service}"`,
          file: "wrangler.jsonc",
        });
      } else {
        errors.push({
          worker: workerName,
          severity: "error",
          message: `Missing service binding: ${expected.binding} -> ${expected.service}`,
          file: "wrangler.jsonc",
        });
      }
    }
  }

  // Check no extra service bindings
  for (const declared of declaredServices) {
    const expected = manifest.services.find(
      (s) => s.binding === declared.binding
    );
    if (!expected) {
      errors.push({
        worker: workerName,
        severity: "warning",
        message: `Unexpected service binding: ${declared.binding}`,
        file: "wrangler.jsonc",
      });
    }
  }

  return errors;
}

/**
 * Validate root wrangler.jsonc secrets list against manifest.
 */
export function validateRootSecrets(
  workerName: string,
  manifest: WorkerManifest,
  rootJsoncContent: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  let parsed: any;
  try {
    parsed = parse(rootJsoncContent);
  } catch {
    errors.push({
      worker: workerName,
      severity: "error",
      message: "Failed to parse root wrangler.jsonc",
    });
    return errors;
  }

  const rootSecrets: string[] = parsed?.workers?.[workerName]?.secrets ?? [];
  const expectedSecrets = Object.entries(manifest.vars)
    .filter(([_, def]) => def.type === "secret")
    .map(([name]) => name);

  for (const expected of expectedSecrets) {
    if (!rootSecrets.includes(expected)) {
      errors.push({
        worker: workerName,
        severity: "error",
        message: `Secret "${expected}" missing from root wrangler.jsonc workers.${workerName}.secrets`,
        file: "wrangler.jsonc (root)",
      });
    }
  }

  return errors;
}

/**
 * Validate .dev.vars content against manifest.
 */
export function validateDevVars(
  workerName: string,
  manifest: WorkerManifest,
  devVarsContent: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Parse .env style file
  const vars = new Map<string, string>();
  for (const line of devVarsContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    vars.set(
      trimmed.substring(0, eqIdx).trim(),
      trimmed.substring(eqIdx + 1).trim()
    );
  }

  for (const [name, def] of Object.entries(manifest.vars)) {
    if (def.type !== "secret") continue;
    if (!vars.has(name)) {
      errors.push({
        worker: workerName,
        severity: "error",
        message: `Missing "${name}" in .dev.vars`,
        file: ".dev.vars",
      });
    }
  }

  return errors;
}

/**
 * Run all validators for a worker.
 */
export function validateAll(
  workerName: string,
  manifest: WorkerManifest,
  files: {
    wranglerJsonc: string;
    rootWranglerJsonc: string;
    devVars: string;
  }
): { worker: string; passed: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [
    ...validateWranglerJsonc(workerName, manifest, files.wranglerJsonc),
    ...validateRootSecrets(workerName, manifest, files.rootWranglerJsonc),
    ...validateDevVars(workerName, manifest, files.devVars),
  ];
  return {
    worker: workerName,
    passed: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/schemas/validators.ts
git commit -m "feat(schemas): add validators for wrangler.jsonc, root secrets, and .dev.vars"
```

---

### Task 4: Create `schemas/index.ts` — public exports

**Files:**

- Create: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Write the barrel export**

```typescript
export type {
  WorkerManifest,
  VarDef,
  ServiceBindingDef,
  InfraBindings,
  KVBindingDef,
  D1BindingDef,
  R2BindingDef,
  QueueBindingDef,
  VectorizeBindingDef,
  DOBindingDef,
  ValidationError,
  ValidationReport,
} from "./types.js";

export { WORKER_MANIFESTS, WORKER_NAMES, CALLED_BY } from "./registry.js";

export {
  validateWranglerJsonc,
  validateRootSecrets,
  validateDevVars,
  validateAll,
} from "./validators.js";
```

- [ ] **Step 2: Update `packages/shared/src/index.ts` to re-export schemas**

Append after existing exports:

```typescript
export * from "./schemas/index.js";
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/index.ts
git add packages/shared/src/index.ts
git commit -m "feat(schemas): add barrel exports and wire into shared package"
```

---

### Task 5: Create CLI schema command — validate + list

**Files:**

- Create: `packages/cli/src/services/schema/index.ts`
- Create: `packages/cli/src/services/schema/schema-service.ts`
- Create: `packages/cli/src/commands/schema/index.ts`
- Create: `packages/cli/src/commands/schema/schema-command.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Create SchemaService that reads files and runs validators**

```typescript
// packages/cli/src/services/schema/schema-service.ts
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  WORKER_MANIFESTS,
  WORKER_NAMES,
  validateWranglerJsonc,
  validateRootSecrets,
  validateAll,
  type WorkerManifest,
  type ValidationError,
} from "@jango-blockchained/hoox-shared";

export interface SchemaCheckResult {
  worker: string;
  passed: boolean;
  errors: ValidationError[];
}

export class SchemaService {
  constructor(private projectRoot: string = process.cwd()) {}

  getWorkerNames(): string[] {
    return WORKER_NAMES;
  }

  getManifest(name: string): WorkerManifest | undefined {
    return WORKER_MANIFESTS[name];
  }

  validateWorker(name: string): SchemaCheckResult {
    const manifest = WORKER_MANIFESTS[name];
    if (!manifest) {
      return {
        worker: name,
        passed: false,
        errors: [
          {
            worker: name,
            severity: "error",
            message: `Unknown worker "${name}"`,
          },
        ],
      };
    }

    const workersDir = resolve(this.projectRoot, "workers");
    const rootWranglerPath = resolve(this.projectRoot, "wrangler.jsonc");
    const workerWranglerPath = resolve(workersDir, name, "wrangler.jsonc");
    const devVarsPath = resolve(workersDir, name, ".dev.vars");

    const errors: ValidationError[] = [];

    // Read and validate per-worker wrangler.jsonc
    try {
      const wranglerContent = readFileSync(workerWranglerPath, "utf-8");
      errors.push(...validateWranglerJsonc(name, manifest, wranglerContent));
    } catch (e: any) {
      errors.push({
        worker: name,
        severity: "error",
        message: `Cannot read ${workerWranglerPath}: ${e.message}`,
      });
    }

    // Read and validate root wrangler.jsonc (if exists)
    try {
      const rootContent = readFileSync(rootWranglerPath, "utf-8");
      errors.push(...validateRootSecrets(name, manifest, rootContent));
    } catch (e: any) {
      errors.push({
        worker: name,
        severity: "warning",
        message: `Cannot read root wrangler.jsonc: ${e.message}`,
      });
    }

    // Read and validate .dev.vars (if exists)
    try {
      const devVarsContent = readFileSync(devVarsPath, "utf-8");
      const { validateDevVars } = require("@jango-blockchained/hoox-shared");
      errors.push(...validateDevVars(name, manifest, devVarsContent));
    } catch (e: any) {
      errors.push({
        worker: name,
        severity: "warning",
        message: `Cannot read ${devVarsPath}: ${e.message}`,
      });
    }

    return {
      worker: name,
      passed: errors.filter((e) => e.severity === "error").length === 0,
      errors,
    };
  }

  validateAll(): SchemaCheckResult[] {
    return WORKER_NAMES.map((name) => this.validateWorker(name));
  }
}
```

- [ ] **Step 2: Create CLI command**

```typescript
// packages/cli/src/commands/schema/schema-command.ts
import { Command } from "commander";
import { SchemaService } from "../../services/schema/schema-service.js";
import {
  formatSuccess,
  formatError,
  getFormatOptions,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";

export function registerSchemaCommand(program: Command): void {
  const schemaCmd = program
    .command("schema")
    .summary("Validate and manage worker configuration")
    .description(
      "Validate, generate, and repair worker wrangler.jsonc against canonical manifests."
    );

  schemaCmd
    .command("validate [worker]")
    .description(
      "Validate worker(s) against manifest (omit worker to validate all)"
    )
    .action(async (worker?: string) => {
      const fmt = getFormatOptions(schemaCmd);
      const svc = new SchemaService();
      const results = worker ? [svc.validateWorker(worker)] : svc.validateAll();
      let totalErrors = 0;
      for (const r of results) {
        if (r.passed) {
          formatSuccess(`${r.worker}: ✅ passed`, fmt);
        } else {
          formatError(
            new CLIError(
              `${r.worker}: ❌ failed (${r.errors.length} issues)`,
              ExitCode.ERROR
            ),
            fmt
          );
          for (const e of r.errors.filter((e) => e.severity === "error")) {
            process.stderr.write(`  ✗ ${e.message}\n`);
          }
          totalErrors += r.errors.filter((e) => e.severity === "error").length;
        }
      }
      if (totalErrors > 0) process.exitCode = ExitCode.ERROR;
    });

  schemaCmd
    .command("list")
    .description("List all workers with their binding counts")
    .action(async () => {
      const svc = new SchemaService();
      for (const name of svc.getWorkerNames()) {
        const m = svc.getManifest(name)!;
        const secretCount = Object.values(m.vars).filter(
          (v) => v.type === "secret"
        ).length;
        const svcCount = m.services.length;
        const infraCount = Object.keys(m.infrastructure).length;
        console.log(
          `${name.padEnd(22)} ${String(secretCount).padStart(2)} secrets  ${String(svcCount).padStart(2)} services  ${String(infraCount).padStart(2)} infra  ${m.middleware.length ? m.middleware.join(", ") : "—"}`
        );
      }
    });
}
```

- [ ] **Step 3: Wire into CLI**

```typescript
// packages/cli/src/commands/schema/index.ts
export { registerSchemaCommand } from "./schema-command.js";
```

```typescript
// packages/cli/src/services/schema/index.ts
export { SchemaService } from "./schema-service.js";
```

In `packages/cli/src/index.ts`, import and call `registerSchemaCommand(program)`.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/schema/
git add packages/cli/src/services/schema/
git add packages/cli/src/index.ts
git commit -m "feat(cli): add 'hoox schema validate' and 'hoox schema list' commands"
```

---

### Task 6: Integrate schema validate into existing `repair check`

**Files:**

- Modify: `packages/cli/src/commands/repair/repair-service.ts`

- [ ] **Step 1: Add schema validation as Step 6 in runSystemCheck**

After the existing 5 steps (after line 124), add:

```typescript
// Step 6: Worker config schema validation
try {
  const { SchemaService } =
    await import("../../services/schema/schema-service.js");
  const svc = new SchemaService();
  const results = svc.validateAll();
  const totalErrors = results.reduce(
    (sum, r) => sum + r.errors.filter((e) => e.severity === "error").length,
    0
  );
  steps.push({
    step: "Worker config schema",
    success: totalErrors === 0,
    message:
      totalErrors === 0
        ? "All workers match manifest"
        : `${totalErrors} schema issue(s) found`,
  });
} catch (err) {
  steps.push({
    step: "Worker config schema",
    success: false,
    error: String(err),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/commands/repair/repair-service.ts
git commit -m "feat(cli): integrate schema validation into repair check"
```

---

### Task 7: Refactor wizard presets to derive from registry

**Files:**

- Modify: `packages/shared/src/wizard/presets.ts`

- [ ] **Step 1: Update presets to import from schema registry**

Replace the `BASE_SECRETS` and `INTEGRATIONS` secret lists with derived data from `WORKER_MANIFESTS`, preserving the old export API for backward compat:

```typescript
import { WORKER_MANIFESTS } from "../schemas/registry.js";
import type { WorkerPreset, IntegratedService } from "./types";

// Derive integrations from manifests
export function getIntegrations(): IntegratedService[] {
  const result: IntegratedService[] = [];
  // ... construct from WORKER_MANIFESTS data
  return result;
}
```

The existing `BASE_SECRETS` and `INTEGRATIONS` constants that use old naming (`BINANCE_KEY_BINDING`) must be updated to use `_BINDING` names from the registry. Each integration's `secrets` should reference the same names as the manifest.

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/wizard/presets.ts
git commit -m "refactor(wizard): derive presets from schema registry"
```

---

### Task 8: Add generate functions to validators

**Files:**

- Modify: `packages/shared/src/schemas/validators.ts`

- [ ] **Step 1: Add generateWranglerJsonc**

```typescript
/**
 * Generate a complete per-worker wrangler.jsonc from a manifest.
 */
export function generateWranglerJsonc(manifest: WorkerManifest): string {
  const lines: string[] = [];
  lines.push("{");
  lines.push(`  "name": "${manifest.name}",`);
  lines.push(`  "main": "src/index.ts",`);

  // vars
  const varKeys = Object.keys(manifest.vars);
  if (varKeys.length > 0) {
    lines.push(`  "vars": {`);
    for (const [i, name] of varKeys.entries()) {
      const def = manifest.vars[name];
      const comma = i < varKeys.length - 1 ? "," : "";
      if (def.type === "secret") {
        lines.push(`    "${name}": "__SECRET__"${comma}`);
      } else {
        lines.push(
          `    "${name}": ${JSON.stringify(def.default ?? "")}${comma}`
        );
      }
    }
    lines.push(`  },`);
  }

  // services
  if (manifest.services.length > 0) {
    lines.push(`  "services": [`); // ... etc
    for (const [i, svc] of manifest.services.entries()) {
      const comma = i < manifest.services.length - 1 ? "," : "";
      lines.push(
        `    { "binding": "${svc.binding}", "service": "${svc.service}" }${comma}`
      );
    }
    lines.push(`  ],`);
  }

  // infrastructure (kv, d1, r2, ai, queues etc.)
  // ... build from manifest.infrastructure

  lines.push("}");
  return lines.join("\n") + "\n";
}

/**
 * Generate a .dev.vars template from a manifest.
 */
export function generateDevVars(manifest: WorkerManifest): string {
  const lines: string[] = [];
  lines.push(`# ${manifest.name} — Environment Variables`);
  lines.push(`# Auto-generated from worker manifest schema`);
  lines.push("");
  for (const [name, def] of Object.entries(manifest.vars)) {
    if (def.type === "secret") {
      lines.push(`${name}=placeholder_${name.toLowerCase()}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
```

- [ ] **Step 2: Add `hoox schema generate` CLI command**

In `schema-command.ts`, add:

```typescript
schemaCmd
  .command("generate <worker>")
  .description("Generate wrangler.jsonc and .dev.vars from manifest")
  .option("--dry-run", "Print generated content without writing")
  .action(async (worker: string, opts: { dryRun?: boolean }) => {
    // Use generateWranglerJsonc + generateDevVars
    // Write to workers/<name>/wrangler.jsonc and workers/<name>/.dev.vars
    // or print to stdout if --dry-run
  });
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/validators.ts
git add packages/cli/src/commands/schema/schema-command.ts
git commit -m "feat(schemas): add generate functions and CLI generate command"
```

---

### Task 9: Add tests for registry and validators

**Files:**

- Create: `packages/shared/src/schemas/registry.test.ts`
- Create: `packages/shared/src/schemas/validators.test.ts`

- [ ] **Step 1: Write registry tests**

```typescript
import { describe, expect, it } from "bun:test";
import { WORKER_MANIFESTS, WORKER_NAMES, CALLED_BY } from "./registry.js";

describe("Worker Registry", () => {
  it("should have all 10 workers", () => {
    expect(WORKER_NAMES).toHaveLength(10);
    expect(WORKER_NAMES).toContain("hoox");
    expect(WORKER_NAMES).toContain("dashboard");
  });

  it("each worker should have a name and path", () => {
    for (const [name, m] of Object.entries(WORKER_MANIFESTS)) {
      expect(m.name).toBe(name);
      expect(m.path).toMatch(/^workers\//);
    }
  });

  it("deriveCalledBy should compute reverse mappings", () => {
    // hoox calls trade-worker -> trade-worker's calledBy should include hoox
    expect(CALLED_BY["trade-worker"]).toContain("hoox");
    // hoox calls telegram-worker -> telegram-worker's calledBy should include hoox
    expect(CALLED_BY["telegram-worker"]).toContain("hoox");
  });

  it("every service binding target should be a known worker", () => {
    for (const [name, m] of Object.entries(WORKER_MANIFESTS)) {
      for (const svc of m.services) {
        expect(WORKER_NAMES).toContain(svc.service);
      }
    }
  });
});
```

- [ ] **Step 2: Write validator tests**

```typescript
import { describe, expect, it } from "bun:test";
import { validateWranglerJsonc, validateRootSecrets } from "./validators.js";
import { WORKER_MANIFESTS } from "./registry.js";

describe("validateWranglerJsonc", () => {
  const manifest = WORKER_MANIFESTS["d1-worker"]!;

  it("should pass for a valid wrangler.jsonc", () => {
    const jsonc = JSON.stringify({
      name: "d1-worker",
      main: "src/index.ts",
      vars: { INTERNAL_KEY_BINDING: "__SECRET__" },
      services: [],
    });
    const errors = validateWranglerJsonc("d1-worker", manifest, jsonc);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });

  it("should detect missing vars", () => {
    const jsonc = JSON.stringify({
      name: "d1-worker",
      main: "src/index.ts",
      vars: {},
      services: [],
    });
    const errors = validateWranglerJsonc("d1-worker", manifest, jsonc);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(1);
    expect(errors[0].message).toContain("INTERNAL_KEY_BINDING");
  });
});

describe("validateRootSecrets", () => {
  const manifest = WORKER_MANIFESTS["d1-worker"]!;

  it("should detect when secret is missing from root config", () => {
    const rootJsonc = JSON.stringify({
      workers: {
        "d1-worker": {
          enabled: true,
          path: "workers/d1-worker",
          vars: {},
          secrets: [],
        },
      },
    });
    const errors = validateRootSecrets("d1-worker", manifest, rootJsonc);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(1);
    expect(errors[0].message).toContain("INTERNAL_KEY_BINDING");
  });
});
```

- [ ] **Step 3: Run tests and verify they pass**

Run: `cd /home/jango/Git/hoox-setup && bun test packages/shared/src/schemas/`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/registry.test.ts
git add packages/shared/src/schemas/validators.test.ts
git commit -m "test(schemas): add tests for registry and validators"
```
