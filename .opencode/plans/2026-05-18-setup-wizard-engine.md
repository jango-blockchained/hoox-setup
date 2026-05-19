# Setup Wizard Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a shared wizard engine in `packages/shared` that powers both CLI `hoox init` and TUI SetupWizard, filling all gaps (infra provisioning, TUI config write, presets with deps, state persistence).

**Architecture:** Pure-logic state machine in shared package (Worker-compatible), consumed by thin UI wrappers in CLI (`@clack/prompts`) and TUI (OpenTUI React). Provisioning abstracted behind interface with separate implementations.

**Tech Stack:** TypeScript strict mode, existing `packages/shared` patterns, existing `INTEGRATIONS` config, existing `CloudflareService` patterns, Zustand stores.

**Spec:** `.opencode/specs/2026-05-18-setup-wizard-engine-design.md`

---

### Task 1: Create shared wizard types & interfaces

**Files:**

- Create: `packages/shared/src/wizard/types.ts`
- Create: `packages/shared/src/wizard/provisioner.ts`
- Create: `packages/shared/src/wizard/index.ts`

- [x] **Step 1: Define core types**

`packages/shared/src/wizard/types.ts`:

```typescript
/**
 * Shared types for the Setup Wizard Engine.
 * Pure types — no runtime dependencies, Worker-compatible.
 */

export type StepId =
  | "PREREQUISITES"
  | "CLOUDFLARE_CONFIG"
  | "WORKER_SELECTION"
  | "PROVISIONING"
  | "SECRETS"
  | "CONFIG_WRITE"
  | "DEPLOY"
  | "DONE";

export type WorkerPresetName = "minimal" | "standard" | "full" | "custom";

export interface WorkerPreset {
  name: WorkerPresetName;
  label: string;
  description: string;
  workers: string[];
  integrations: string[];
}

export interface IntegratedService {
  key: string;
  label: string;
  workerName: string;
  secrets: Record<string, string>; // name -> prompt label
  vars?: Record<string, string>;
}

export interface WorkerConfig {
  enabled: boolean;
  path: string;
  vars: Record<string, string>;
  secrets: string[];
}

export interface WorkersJsonConfig {
  global: {
    cloudflare_api_token: string;
    cloudflare_account_id: string;
    cloudflare_secret_store_id: string;
    subdomain_prefix: string;
  };
  workers: Record<string, WorkerConfig>;
}

export interface ProvisioningPlan {
  d1Databases: string[];
  kvNamespaces: string[];
  r2Buckets: string[];
  queues: string[];
}

export interface ProvisionResult {
  success: boolean;
  created: string[];
  errors: string[];
}

export interface WizardCloudflareConfig {
  apiToken: string;
  accountId: string;
  secretStoreId: string;
  subdomain: string;
}

export interface WizardState {
  step: StepId;
  completedSteps: StepId[];
  cloudflareConfig?: WizardCloudflareConfig;
  selectedWorkers: string[];
  selectedIntegrations: string[];
  secrets: Record<string, Record<string, string>>;
  preset?: WorkerPresetName;
  provisioningResults?: ProvisionResult;
  startedAt: number;
  updatedAt: number;
}

export interface StepDefinition {
  id: StepId;
  label: string;
  canGoBack: boolean;
  optional: boolean;
  validate(state: WizardState, input: Record<string, unknown>): string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

- [x] **Step 2: Define Provisioner interface**

`packages/shared/src/wizard/provisioner.ts`:

```typescript
import type { ProvisioningPlan, ProvisionResult } from "./types";

export interface Provisioner {
  provision(plan: ProvisioningPlan): Promise<ProvisionResult>;
  check(plan: ProvisioningPlan): Promise<ProvisionResult>;
}
```

- [x] **Step 3: Create barrel export**

`packages/shared/src/wizard/index.ts`:

```typescript
export type { StepId, WorkerPresetName, WorkerPreset } from "./types";
export type {
  WorkerConfig,
  WorkersJsonConfig,
  IntegratedService,
  ProvisioningPlan,
  ProvisionResult,
  WizardCloudflareConfig,
  WizardState,
  StepDefinition,
  ValidationResult,
} from "./types";
export type { Provisioner } from "./provisioner";
export { WizardEngine } from "./engine";
export {
  PRESETS,
  WORKER_DEPENDENCIES,
  INTEGRATIONS,
  BASE_WORKERS,
  BASE_SECRETS,
  resolveDependencies,
} from "./presets";
```

- [x] **Step 4: Update shared barrel export**

Add to `packages/shared/src/index.ts` (before the Zustand stores section):

```typescript
// ── Wizard engine ───────────────────────────────────────────────────────

export type {
  StepId,
  WorkerPresetName,
  WorkerPreset,
  WorkerConfig,
  WorkersJsonConfig,
  ProvisioningPlan,
  ProvisionResult,
  WizardCloudflareConfig,
  WizardState,
  StepDefinition,
} from "./wizard";
export type { Provisioner } from "./wizard";
export {
  WizardEngine,
  PRESETS,
  WORKER_DEPENDENCIES,
  INTEGRATIONS,
  resolveDependencies,
} from "./wizard";
```

- [x] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: Pass (no errors related to new files)

- [x] **Step 6: Commit**

```bash
git add packages/shared/src/wizard/ packages/shared/src/index.ts
git commit -m "feat(shared): add wizard engine types and interfaces"
```

---

### Task 2: Implement wizard engine state machine

**Files:**

- Create: `packages/shared/src/wizard/engine.ts`
- Create: `packages/shared/src/wizard/__tests__/engine.test.ts`

- [x] **Step 1: Write engine tests**

`packages/shared/src/wizard/__tests__/engine.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { WizardEngine } from "../engine";

describe("WizardEngine", () => {
  it("starts at PREREQUISITES step", () => {
    const engine = new WizardEngine();
    expect(engine.getCurrentStep().id).toBe("PREREQUISITES");
  });

  it("canProceed is false on initial state (no input given)", () => {
    const engine = new WizardEngine();
    expect(engine.canProceed()).toBe(false);
  });

  it("advances to next step after execute succeeds", () => {
    const engine = new WizardEngine();
    const errors = engine.execute({ checksPassed: true });
    expect(errors).toEqual([]);
    expect(engine.getCurrentStep().id).toBe("CLOUDFLARE_CONFIG");
  });

  it("canGoBack is false on PREREQUISITES", () => {
    const engine = new WizardEngine();
    expect(engine.canGoBack()).toBe(false);
  });

  it("canGoBack is true after advancing", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    expect(engine.canGoBack()).toBe(true);
  });

  it("goBack returns to previous step", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.goBack();
    expect(engine.getCurrentStep().id).toBe("PREREQUISITES");
  });

  it("returns validation errors for CLOUDFLARE_CONFIG with empty input", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    const errors = engine.execute({});
    expect(errors.length).toBeGreaterThan(0);
    expect(engine.getCurrentStep().id).toBe("CLOUDFLARE_CONFIG"); // didn't advance
  });

  it("buildConfig returns valid WorkersJsonConfig", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "test-token",
      accountId: "abc123def456abc123def456abc123de",
      secretStoreId: "",
      subdomain: "myapp",
    });
    engine.execute({ preset: "minimal" });
    const config = engine.buildConfig();
    expect(config.global.cloudflare_account_id).toBe(
      "abc123def456abc123def456abc123de"
    );
    expect(config.global.subdomain_prefix).toBe("myapp");
    expect(Object.keys(config.workers).length).toBeGreaterThan(0);
  });

  it("reset clears all state", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.reset();
    expect(engine.getCurrentStep().id).toBe("PREREQUISITES");
    expect(engine.getState().completedSteps).toEqual([]);
  });

  it("returns selected integrations in state", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "test-token",
      accountId: "abc123def456abc123def456abc123de",
      secretStoreId: "",
      subdomain: "myapp",
    });
    engine.execute({ preset: "standard" });
    const state = engine.getState();
    expect(state.selectedIntegrations).toContain("binance");
    expect(state.selectedIntegrations).toContain("telegram");
  });

  it("getProvisioningPlan returns databases for selected workers", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "test-token",
      accountId: "abc123def456abc123def456abc123de",
      secretStoreId: "",
      subdomain: "myapp",
    });
    engine.execute({ preset: "standard" });
    const plan = engine.getProvisioningPlan();
    expect(plan.d1Databases).toBeDefined();
    expect(Array.isArray(plan.d1Databases)).toBe(true);
  });

  it("loads from existing state", () => {
    const existingState = {
      step: "CLOUDFLARE_CONFIG" as const,
      completedSteps: ["PREREQUISITES" as const],
      startedAt: Date.now(),
      updatedAt: Date.now(),
      selectedWorkers: [],
      selectedIntegrations: [],
      secrets: {},
    };
    const engine = new WizardEngine(existingState);
    expect(engine.getCurrentStep().id).toBe("CLOUDFLARE_CONFIG");
    expect(engine.getCompletedSteps()).toContain("PREREQUISITES");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `bun test packages/shared/src/wizard/__tests__/engine.test.ts`
Expected: FAIL (engine.ts doesn't exist yet)

- [x] **Step 3: Implement WizardEngine**

`packages/shared/src/wizard/engine.ts`:

```typescript
import type {
  StepId,
  StepDefinition,
  WizardState,
  WizardCloudflareConfig,
  WorkersJsonConfig,
  WorkerConfig,
  ProvisioningPlan,
  WorkerPresetName,
} from "./types";
import {
  PRESETS,
  INTEGRATIONS,
  BASE_WORKERS,
  BASE_SECRETS,
  resolveDependencies,
} from "./presets";

const STEPS: StepDefinition[] = [
  {
    id: "PREREQUISITES",
    label: "System Prerequisites",
    canGoBack: false,
    optional: false,
    validate: validatePrerequisites,
  },
  {
    id: "CLOUDFLARE_CONFIG",
    label: "Cloudflare Configuration",
    canGoBack: true,
    optional: false,
    validate: validateCloudflareConfig,
  },
  {
    id: "WORKER_SELECTION",
    label: "Worker Selection",
    canGoBack: true,
    optional: false,
    validate: validateWorkerSelection,
  },
  {
    id: "PROVISIONING",
    label: "Infrastructure Provisioning",
    canGoBack: true,
    optional: true,
    validate: () => [],
  },
  {
    id: "SECRETS",
    label: "Secrets Configuration",
    canGoBack: true,
    optional: false,
    validate: validateSecrets,
  },
  {
    id: "CONFIG_WRITE",
    label: "Configuration Write",
    canGoBack: true,
    optional: false,
    validate: () => [],
  },
  {
    id: "DEPLOY",
    label: "Deploy",
    canGoBack: false,
    optional: true,
    validate: () => [],
  },
  {
    id: "DONE",
    label: "Complete",
    canGoBack: false,
    optional: false,
    validate: () => [],
  },
];

const STEP_ORDER: StepId[] = STEPS.map((s) => s.id);

function createInitialState(): WizardState {
  return {
    step: "PREREQUISITES",
    completedSteps: [],
    selectedWorkers: [],
    selectedIntegrations: [],
    secrets: {},
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function validatePrerequisites(
  state: WizardState,
  input: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  if (!input.checksPassed) {
    errors.push("System prerequisite checks must pass before continuing");
  }
  return errors;
}

function validateCloudflareConfig(
  state: WizardState,
  input: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  const token = input.apiToken as string | undefined;
  const accountId = input.accountId as string | undefined;

  if (!token || String(token).trim().length === 0) {
    errors.push("Cloudflare API token is required");
  }
  if (!accountId || String(accountId).trim().length === 0) {
    errors.push("Cloudflare Account ID is required");
  } else if (!/^[a-f0-9]{32}$/i.test(String(accountId).trim())) {
    errors.push("Account ID should be a 32-character hex string");
  }
  return errors;
}

function validateWorkerSelection(
  state: WizardState,
  input: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  const preset = input.preset as WorkerPresetName | undefined;
  const customWorkers = input.workers as string[] | undefined;

  if (preset === "custom" && (!customWorkers || customWorkers.length === 0)) {
    errors.push("At least one worker must be selected");
  }
  return errors;
}

function validateSecrets(
  state: WizardState,
  input: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  const secrets = input.secrets as
    | Record<string, Record<string, string>>
    | undefined;
  if (!secrets || Object.keys(secrets).length === 0) {
    // Secrets are optional per-integration, but require some structure
    return [];
  }
  // Check that required integration secrets have values
  for (const integrationKey of state.selectedIntegrations) {
    const integration = INTEGRATIONS.find((i) => i.key === integrationKey);
    if (!integration) continue;
    const integrationSecrets = secrets[integrationKey];
    if (integrationSecrets) {
      for (const secretName of Object.keys(integration.secrets)) {
        const val = integrationSecrets[secretName];
        if (!val || String(val).trim().length === 0) {
          errors.push(
            `Secret "${integration.secrets[secretName]}" is required for ${integration.label}`
          );
        }
      }
    }
  }
  return errors;
}

export class WizardEngine {
  private state: WizardState;

  constructor(initialState?: Partial<WizardState>) {
    this.state = { ...createInitialState(), ...initialState };
  }

  getState(): WizardState {
    return { ...this.state };
  }

  getCurrentStep(): StepDefinition {
    return STEPS.find((s) => s.id === this.state.step) ?? STEPS[0];
  }

  getCompletedSteps(): StepId[] {
    return [...this.state.completedSteps];
  }

  canProceed(): boolean {
    const step = this.getCurrentStep();
    return step.optional || this.state.completedSteps.includes(step.id);
  }

  canGoBack(): boolean {
    return this.getCurrentStep().canGoBack;
  }

  execute(input: Record<string, unknown>): string[] {
    const currentStep = this.getCurrentStep();
    const errors = currentStep.validate(this.state, input);

    if (errors.length > 0) {
      return errors;
    }

    // Apply input to state
    this.applyInput(input);

    // Mark current step as completed
    if (!this.state.completedSteps.includes(this.state.step)) {
      this.state.completedSteps.push(this.state.step);
    }

    // Advance to next step
    const currentIdx = STEP_ORDER.indexOf(this.state.step);
    if (currentIdx < STEP_ORDER.length - 1) {
      this.state.step = STEP_ORDER[currentIdx + 1];
    }

    this.state.updatedAt = Date.now();
    return [];
  }

  goBack(): void {
    if (!this.canGoBack()) return;
    const currentIdx = STEP_ORDER.indexOf(this.state.step);
    if (currentIdx > 0) {
      const previousStep = STEP_ORDER[currentIdx - 1];
      this.state.step = previousStep;
      // Remove current step from completed
      this.state.completedSteps = this.state.completedSteps.filter(
        (s) =>
          s !== previousStep &&
          STEP_ORDER.indexOf(s) <= STEP_ORDER.indexOf(previousStep)
      );
    }
    this.state.updatedAt = Date.now();
  }

  reset(): void {
    this.state = createInitialState();
  }

  buildConfig(): WorkersJsonConfig {
    const cf = this.state.cloudflareConfig;
    const workers: Record<string, WorkerConfig> = {};

    // Add base workers
    for (const [name, baseCfg] of Object.entries(BASE_WORKERS)) {
      workers[name] = {
        enabled: true,
        path: baseCfg.path,
        vars: { ...baseCfg.vars },
        secrets: [...(BASE_SECRETS[name] ?? [])],
      };
    }

    // Add integration workers
    for (const key of this.state.selectedIntegrations) {
      const integration = INTEGRATIONS.find((i) => i.key === key);
      if (!integration) continue;

      const workerName = integration.workerName;
      if (!workers[workerName]) {
        workers[workerName] = {
          enabled: true,
          path: `workers/${workerName}`,
          vars: {},
          secrets: [],
        };
      }

      if (integration.vars) {
        Object.assign(workers[workerName].vars, integration.vars);
      }

      for (const secretName of Object.keys(integration.secrets)) {
        if (!workers[workerName].secrets.includes(secretName)) {
          workers[workerName].secrets.push(secretName);
        }
      }
    }

    // Add extra selected workers not covered by integrations
    for (const workerName of this.state.selectedWorkers) {
      if (!workers[workerName]) {
        workers[workerName] = {
          enabled: true,
          path: `workers/${workerName}`,
          vars: {},
          secrets: [],
        };
      }
    }

    return {
      global: {
        cloudflare_api_token: cf?.apiToken ?? "",
        cloudflare_account_id: cf?.accountId ?? "",
        cloudflare_secret_store_id: cf?.secretStoreId ?? "",
        subdomain_prefix: cf?.subdomain ?? "",
      },
      workers,
    };
  }

  getProvisioningPlan(): ProvisioningPlan {
    const plan: ProvisioningPlan = {
      d1Databases: [],
      kvNamespaces: [],
      r2Buckets: [],
      queues: [],
    };

    const allWorkers = [
      ...Object.keys(BASE_WORKERS),
      ...this.state.selectedWorkers,
      ...this.state.selectedIntegrations
        .map((k) => {
          const i = INTEGRATIONS.find((i) => i.key === k);
          return i?.workerName ?? "";
        })
        .filter(Boolean),
    ];

    const workerSet = new Set(allWorkers);

    if (workerSet.has("d1-worker")) {
      plan.d1Databases.push("hoox-db");
    }
    if (workerSet.has("hoox") || workerSet.has("analytics-worker")) {
      plan.kvNamespaces.push("CONFIG_KV");
    }
    if (workerSet.has("web3-wallet-worker")) {
      plan.kvNamespaces.push("WEB3_CACHE_KV");
    }

    return plan;
  }

  private applyInput(input: Record<string, unknown>): void {
    const step = this.state.step;

    switch (step) {
      case "PREREQUISITES":
        // No state mutation needed for prerequisites
        break;

      case "CLOUDFLARE_CONFIG":
        this.state.cloudflareConfig = {
          apiToken: String(input.apiToken ?? ""),
          accountId: String(input.accountId ?? ""),
          secretStoreId: String(input.secretStoreId ?? ""),
          subdomain: String(input.subdomain ?? "cryptolinx"),
        };
        break;

      case "WORKER_SELECTION": {
        const preset = input.preset as WorkerPresetName;
        this.state.preset = preset;

        if (preset && preset !== "custom") {
          const presetDef = PRESETS.find((p) => p.name === preset);
          if (presetDef) {
            const resolved = resolveDependencies(presetDef.workers);
            this.state.selectedWorkers = resolved;
            this.state.selectedIntegrations = presetDef.integrations;
          }
        } else {
          const workers = input.workers as string[] | undefined;
          const integrations = input.integrations as string[] | undefined;
          if (workers) {
            this.state.selectedWorkers = resolveDependencies(workers);
          }
          if (integrations) {
            this.state.selectedIntegrations = integrations;
          }
        }
        break;
      }

      case "SECRETS":
        this.state.secrets =
          (input.secrets as Record<string, Record<string, string>>) ?? {};
        break;

      case "PROVISIONING":
        if (input.provisioningResults) {
          this.state.provisioningResults =
            input.provisioningResults as import("./types").ProvisionResult;
        }
        break;

      case "CONFIG_WRITE":
      case "DEPLOY":
      case "DONE":
        // No state mutation for these steps (handled externally)
        break;
    }
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `bun test packages/shared/src/wizard/__tests__/engine.test.ts`
Expected: PASS (all tests)

- [x] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: Pass

- [x] **Step 6: Commit**

```bash
git add packages/shared/src/wizard/engine.ts packages/shared/src/wizard/__tests__/
git commit -m "feat(shared): implement wizard engine state machine"
```

---

### Task 3: Implement presets with dependency resolution

**Files:**

- Create: `packages/shared/src/wizard/presets.ts`
- Create: `packages/shared/src/wizard/__tests__/presets.test.ts`

- [x] **Step 1: Write preset tests**

`packages/shared/src/wizard/__tests__/presets.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  PRESETS,
  resolveDependencies,
  WORKER_DEPENDENCIES,
  INTEGRATIONS,
  BASE_WORKERS,
  BASE_SECRETS,
} from "../presets";

describe("PRESETS", () => {
  it("has 3 presets", () => {
    expect(PRESETS.length).toBe(3);
  });

  it("minimal preset has hoox and d1-worker", () => {
    const minimal = PRESETS.find((p) => p.name === "minimal");
    expect(minimal).toBeDefined();
    expect(minimal!.workers).toContain("hoox");
    expect(minimal!.workers).toContain("d1-worker");
  });

  it("full preset has all workers", () => {
    const full = PRESETS.find((p) => p.name === "full");
    expect(full).toBeDefined();
    expect(full!.workers.length).toBeGreaterThan(3);
  });
});

describe("resolveDependencies", () => {
  it("returns same list if no dependencies", () => {
    expect(resolveDependencies(["hoox"])).toEqual(["hoox"]);
  });

  it("adds d1-worker when trade-worker is selected", () => {
    const resolved = resolveDependencies(["trade-worker"]);
    expect(resolved).toContain("trade-worker");
    expect(resolved).toContain("d1-worker");
  });

  it("handles transitive dependencies", () => {
    const resolved = resolveDependencies(["trade-worker", "agent-worker"]);
    expect(resolved).toContain("d1-worker");
  });

  it("does not duplicate entries", () => {
    const resolved = resolveDependencies(["trade-worker", "d1-worker"]);
    expect(resolved.filter((w) => w === "d1-worker").length).toBe(1);
  });
});

describe("INTEGRATIONS", () => {
  it("includes all expected integrations", () => {
    const keys = INTEGRATIONS.map((i) => i.key);
    expect(keys).toContain("binance");
    expect(keys).toContain("bybit");
    expect(keys).toContain("mexc");
    expect(keys).toContain("wallet");
    expect(keys).toContain("email");
    expect(keys).toContain("telegram");
    expect(keys).toContain("openai");
    expect(keys).toContain("anthropic");
    expect(keys).toContain("google-ai");
  });
});

describe("BASE_WORKERS", () => {
  it("includes d1-worker, hoox, agent-worker, analytics-worker", () => {
    expect(Object.keys(BASE_WORKERS)).toContain("d1-worker");
    expect(Object.keys(BASE_WORKERS)).toContain("hoox");
    expect(Object.keys(BASE_WORKERS)).toContain("agent-worker");
    expect(Object.keys(BASE_WORKERS)).toContain("analytics-worker");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `bun test packages/shared/src/wizard/__tests__/presets.test.ts`
Expected: FAIL (presets.ts doesn't exist yet)

- [x] **Step 3: Implement presets**

`packages/shared/src/wizard/presets.ts`:

```typescript
import type { WorkerPreset, IntegratedService } from "./types";

export const PRESETS: WorkerPreset[] = [
  {
    name: "minimal",
    label: "Minimal",
    description: "Gateway + D1 database — webhook processing only",
    workers: ["hoox", "d1-worker", "analytics-worker"],
    integrations: [],
  },
  {
    name: "standard",
    label: "Standard",
    description: "Trading + analytics + Telegram notifications",
    workers: [
      "hoox",
      "d1-worker",
      "trade-worker",
      "analytics-worker",
      "telegram-worker",
    ],
    integrations: ["binance", "telegram"],
  },
  {
    name: "full",
    label: "Full",
    description: "All workers + AI agent + DeFi + email",
    workers: [
      "hoox",
      "d1-worker",
      "trade-worker",
      "agent-worker",
      "telegram-worker",
      "analytics-worker",
      "email-worker",
      "web3-wallet-worker",
    ],
    integrations: ["binance", "bybit", "mexc", "telegram", "openai", "wallet"],
  },
];

/**
 * Worker dependency graph.
 * Key requires all values in its array.
 */
export const WORKER_DEPENDENCIES: Record<string, string[]> = {
  "trade-worker": ["d1-worker"],
  "agent-worker": ["d1-worker"],
  "email-worker": ["d1-worker"],
  "analytics-worker": ["d1-worker"],
  "web3-wallet-worker": ["d1-worker", "hoox"],
};

/**
 * Resolve transitive worker dependencies.
 * Returns a deduplicated array of all workers including dependencies.
 */
export function resolveDependencies(selected: string[]): string[] {
  const result = new Set(selected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const worker of [...result]) {
      const deps = WORKER_DEPENDENCIES[worker];
      if (deps) {
        for (const dep of deps) {
          if (!result.has(dep)) {
            result.add(dep);
            changed = true;
          }
        }
      }
    }
  }
  return [...result];
}

/**
 * All supported integrations.
 * Migrated from packages/cli/src/commands/init/types.ts
 */
export const INTEGRATIONS: IntegratedService[] = [
  {
    key: "binance",
    label: "Binance Exchange",
    workerName: "trade-worker",
    secrets: {
      BINANCE_KEY_BINDING: "Binance API Key",
      BINANCE_SECRET_BINDING: "Binance API Secret",
    },
  },
  {
    key: "mexc",
    label: "MEXC Exchange",
    workerName: "trade-worker",
    secrets: {
      MEXC_KEY_BINDING: "MEXC API Key",
      MEXC_SECRET_BINDING: "MEXC API Secret",
    },
  },
  {
    key: "bybit",
    label: "Bybit Exchange",
    workerName: "trade-worker",
    secrets: {
      BYBIT_KEY_BINDING: "Bybit API Key",
      BYBIT_SECRET_BINDING: "Bybit API Secret",
    },
  },
  {
    key: "wallet",
    label: "Web3 Wallet (on-chain execution)",
    workerName: "web3-wallet-worker",
    secrets: {
      WALLET_MNEMONIC_SECRET: "Wallet Mnemonic Phrase",
      WALLET_PK_SECRET: "Wallet Private Key",
    },
  },
  {
    key: "email",
    label: "Email Signal Parsing",
    workerName: "email-worker",
    secrets: {
      EMAIL_HOST_BINDING: "Email Host (IMAP server)",
      EMAIL_USER_BINDING: "Email Username",
      EMAIL_PASS_BINDING: "Email Password",
      INTERNAL_KEY_BINDING: "Internal Auth Key",
    },
    vars: { USE_IMAP: "false" },
  },
  {
    key: "telegram",
    label: "Telegram Notifications",
    workerName: "telegram-worker",
    secrets: {
      TG_BOT_TOKEN_BINDING: "Telegram Bot Token",
    },
  },
  {
    key: "openai",
    label: "OpenAI (AI Agent)",
    workerName: "agent-worker",
    secrets: {
      AGENT_INTERNAL_KEY: "OpenAI API Key",
    },
  },
  {
    key: "anthropic",
    label: "Anthropic (AI Agent)",
    workerName: "agent-worker",
    secrets: {
      AGENT_INTERNAL_KEY: "Anthropic API Key",
    },
  },
  {
    key: "google-ai",
    label: "Google AI (AI Agent)",
    workerName: "agent-worker",
    secrets: {
      AGENT_INTERNAL_KEY: "Google AI API Key",
    },
  },
  {
    key: "home-assistant",
    label: "Home Assistant (Smart Home)",
    workerName: "hoox",
    secrets: {
      HA_TOKEN_BINDING: "Home Assistant Token",
    },
  },
];

/**
 * Base workers always enabled.
 */
export const BASE_WORKERS: Record<
  string,
  { enabled: boolean; path: string; vars: Record<string, string> }
> = {
  "d1-worker": {
    enabled: true,
    path: "workers/d1-worker",
    vars: { database_name: "hoox-db" },
  },
  hoox: { enabled: true, path: "workers/hoox", vars: {} },
  "agent-worker": { enabled: true, path: "workers/agent-worker", vars: {} },
  "analytics-worker": {
    enabled: true,
    path: "workers/analytics-worker",
    vars: {},
  },
};

/**
 * Base secrets for base workers.
 */
export const BASE_SECRETS: Record<string, string[]> = {
  hoox: ["WEBHOOK_API_KEY_BINDING"],
  "agent-worker": ["AGENT_INTERNAL_KEY"],
  "analytics-worker": ["CLOUDFLARE_API_TOKEN"],
  "trade-worker": ["API_SERVICE_KEY_BINDING"],
};
```

- [x] **Step 4: Run tests to verify they pass**

Run: `bun test packages/shared/src/wizard/__tests__/presets.test.ts`
Expected: PASS

- [x] **Step 5: Run all engine + preset tests**

Run: `bun test packages/shared/src/wizard/`
Expected: All pass

- [x] **Step 6: Run typecheck**

Run: `bun run typecheck`
Expected: Pass

- [x] **Step 7: Commit**

```bash
git add packages/shared/src/wizard/presets.ts packages/shared/src/wizard/__tests__/presets.test.ts
git commit -m "feat(shared): add worker presets, dependency resolution, and integration configs"
```

---

### Task 4: Implement persistence module

**Files:**

- Create: `packages/shared/src/wizard/persistence.ts`
- Create: `packages/shared/src/wizard/__tests__/persistence.test.ts`
- Modify: `packages/shared/src/wizard/index.ts` (add re-export)

- [x] **Step 1: Write persistence tests**

`packages/shared/src/wizard/__tests__/persistence.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { serializeState, deserializeState } from "../persistence";
import type { WizardState } from "../types";

describe("persistence", () => {
  it("serializes and deserializes state", () => {
    const state: WizardState = {
      step: "CLOUDFLARE_CONFIG",
      completedSteps: ["PREREQUISITES"],
      cloudflareConfig: {
        apiToken: "tok_xxx",
        accountId: "abc123",
        secretStoreId: "ss_1",
        subdomain: "myapp",
      },
      selectedWorkers: ["hoox", "d1-worker"],
      selectedIntegrations: ["binance"],
      secrets: { binance: { BINANCE_KEY_BINDING: "key123" } },
      preset: "minimal",
      startedAt: 1000,
      updatedAt: 2000,
    };

    const json = serializeState(state);
    const parsed = deserializeState(json);
    expect(parsed.step).toBe("CLOUDFLARE_CONFIG");
    expect(parsed.cloudflareConfig?.apiToken).toBe("tok_xxx");
    expect(parsed.selectedWorkers).toContain("hoox");
    expect(parsed.selectedIntegrations).toContain("binance");
    expect(parsed.secrets?.binance?.BINANCE_KEY_BINDING).toBe("key123");
  });
});
```

- [x] **Step 2: Implement persistence**

`packages/shared/src/wizard/persistence.ts`:

```typescript
import type { WizardState } from "./types";

/**
 * Serialize wizard state to JSON string.
 */
export function serializeState(state: WizardState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Deserialize wizard state from JSON string.
 */
export function deserializeState(json: string): WizardState {
  const parsed = JSON.parse(json);
  return parsed as WizardState;
}

/**
 * Path for wizard state file.
 */
export const WIZARD_STATE_PATH = ".wizard-state.json";
```

- [x] **Step 3: Add re-export to wizard/index.ts**

Add to `packages/shared/src/wizard/index.ts`:

```typescript
export {
  serializeState,
  deserializeState,
  WIZARD_STATE_PATH,
} from "./persistence";
```

- [x] **Step 4: Run tests**

Run: `bun test packages/shared/src/wizard/`
Expected: All pass

- [x] **Step 5: Commit**

```bash
git add packages/shared/src/wizard/persistence.ts packages/shared/src/wizard/__tests__/persistence.test.ts packages/shared/src/wizard/index.ts
git commit -m "feat(shared): add wizard state persistence module"
```

---

### Task 5: Refactor CLI `hoox init` to use engine

**Files:**

- Modify: `packages/cli/src/commands/init/init-command.ts` (rewrite to use WizardEngine)
- Modify: `packages/cli/src/commands/init/types.ts` (re-export from shared, keep CLI-specific)
- Create: `packages/cli/src/commands/init/cli-provisioner.ts`
- Modify: `packages/cli/src/commands/init/init-command.test.ts`

- [x] **Step 1: Create CLI provisioner**

`packages/cli/src/commands/init/cli-provisioner.ts`:

```typescript
import type {
  Provisioner,
  ProvisioningPlan,
  ProvisionResult,
} from "@jango-blockchained/hoox-shared/wizard";

/**
 * CLI implementation of the Provisioner interface.
 * Uses `wrangler` CLI via Bun.spawn to create Cloudflare resources.
 */
export class CLIProvisioner implements Provisioner {
  async provision(plan: ProvisioningPlan): Promise<ProvisionResult> {
    const created: string[] = [];
    const errors: string[] = [];

    for (const db of plan.d1Databases) {
      try {
        const proc = Bun.spawn(["wrangler", "d1", "create", db], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const out = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        if (exitCode === 0) {
          created.push(`D1:${db}`);
        } else {
          const err = await new Response(proc.stderr).text();
          errors.push(`D1:${db} — ${err.trim() || `exit code ${exitCode}`}`);
        }
      } catch (e) {
        errors.push(`D1:${db} — ${(e as Error).message}`);
      }
    }

    for (const ns of plan.kvNamespaces) {
      try {
        const proc = Bun.spawn(["wrangler", "kv", "namespace", "create", ns], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const out = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        if (exitCode === 0) {
          created.push(`KV:${ns}`);
        } else {
          const err = await new Response(proc.stderr).text();
          errors.push(`KV:${ns} — ${err.trim() || `exit code ${exitCode}`}`);
        }
      } catch (e) {
        errors.push(`KV:${ns} — ${(e as Error).message}`);
      }
    }

    return {
      success: errors.length === 0,
      created,
      errors,
    };
  }

  async check(plan: ProvisioningPlan): Promise<ProvisionResult> {
    // Dry-run: just report what would be created
    const created: string[] = [
      ...plan.d1Databases.map((d) => `D1:${d}`),
      ...plan.kvNamespaces.map((k) => `KV:${k}`),
    ];
    return { success: true, created, errors: [] };
  }
}
```

- [x] **Step 2: Write CLI provisioner test**

`packages/cli/src/commands/init/__tests__/cli-provisioner.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { CLIProvisioner } from "../cli-provisioner";

describe("CLIProvisioner", () => {
  it("check returns expected resources", async () => {
    const provisioner = new CLIProvisioner();
    const result = await provisioner.check({
      d1Databases: ["hoox-db"],
      kvNamespaces: ["CONFIG_KV"],
      r2Buckets: [],
      queues: [],
    });
    expect(result.success).toBe(true);
    expect(result.created).toContain("D1:hoox-db");
    expect(result.created).toContain("KV:CONFIG_KV");
  });
});
```

- [x] **Step 3: Refactor init-command.ts to use engine**

Rewrite `packages/cli/src/commands/init/init-command.ts` to:

1. Import `WizardEngine` from `@jango-blockchained/hoox-shared/wizard`
2. Import `CLIProvisioner` locally
3. Keep same CLI command structure (`registerInitCommand`)
4. Replace the inline step logic with engine calls
5. Add state persistence via `serializeState` + file writes
6. Add `--resume` flag

Key changes to init-command.ts:

- Remove `buildConfig()` (now in engine)
- Remove `INTEGRATIONS`, `BASE_WORKERS`, `BASE_SECRETS` (now in shared)
- Remove `collectIntegrationSecrets()` (replaced by engine step)
- Add engine-based flow:

```typescript
// In runInitCommand interactive mode:
const engine = new WizardEngine();

// Try to resume
if (options.resume) {
  try {
    const stateFile = Bun.file(WIZARD_STATE_PATH);
    if (await stateFile.exists()) {
      const json = await stateFile.text();
      const existing = deserializeState(json);
      engine = new WizardEngine(existing);
      p.log.info(`Resuming from step ${engine.getCurrentStep().label}`);
    }
  } catch {
    /* ignore */
  }
}

// Step 0: Prerequisites (automatic)
const prereqsOk = await checkPrerequisites();
engine.execute({ checksPassed: prereqsOk });

// Step 1: Cloudflare Config
const cfInput = await collectCloudflareConfig(engine);
engine.execute(cfInput);
await saveState(engine.getState());

// ... continue through all steps ...

// Step 5: Config Write
const config = engine.buildConfig();
await writeWorkersJsonc(config, globalOpts);
await createDevVars(config, engine.getState().secrets, {}, globalOpts);
engine.execute({});

// Step 6: Deploy (optional)
// Step 7: Done
// Clean up state file
```

- [x] **Step 4: Update CLI types.ts**

`packages/cli/src/commands/init/types.ts`:

- Remove `INTEGRATIONS`, `BASE_WORKERS`, `BASE_SECRETS` (moved to shared)
- Add `--resume` flag to `InitOptions`
- Keep `InitOptions`, `WorkersJsonConfig` (though config type is now shared)

- [x] **Step 5: Run CLI tests**

Run: `bun test packages/cli/src/commands/init/`
Expected: Pass

- [x] **Step 6: Run typecheck**

Run: `bun run typecheck`
Expected: Pass

- [x] **Step 7: Commit**

```bash
git add packages/cli/src/commands/init/
git commit -m "feat(cli): refactor hoox init to use shared wizard engine with provisioning and resume"
```

---

### Task 6: Refactor TUI SetupWizard to use engine

**Files:**

- Modify: `packages/tui/src/components/views/setup-wizard.tsx`
- Modify: `packages/tui/src/components/views/setup-wizard.test.tsx`

- [x] **Step 1: Integrate wizard engine into TUI component**

Replace the local `WizardFormData` state management with `WizardEngine` instance.
Map existing OpenTUI form steps to engine step execution.

Core changes:

```typescript
import { WizardEngine } from "@jango-blockchained/hoox-shared/wizard";

// Inside SetupWizard component:
const [engine] = useState(() => new WizardEngine());
const [wizardState, setWizardState] = useState(() => engine.getState());

// After navigation, update local state from engine:
const handleNext = () => {
  const input = buildInputFromForm(step, data);
  const errors = engine.execute(input);
  if (errors.length === 0) {
    setWizardState(engine.getState());
    if (step < TOTAL_SETUP_STEPS - 1) setStep((s) => s + 1);
  } else {
    // Show errors
  }
};
```

- [x] **Step 2: Add config save step**

In the DEPLOY step (step 6), before calling `cliBridge.deployAll()`:

```typescript
// Build and save config
const config = engine.buildConfig();
const configJson = JSON.stringify(config, null, 2);
await Bun.write("wrangler.jsonc", configJson);
engine.execute({});
setWizardState(engine.getState());
```

- [x] **Step 3: Map TUI form fields to engine input**

Map the existing form fields to engine step inputs:

- Prerequisites step auto-runs on mount → `engine.execute({ checksPassed: allPassed })`
- API Keys/Exchanges step → `engine.execute({ preset: "...", integrations: [...] })`
- AI Providers → part of integration selection
- Notifications → part of integration selection
- Deploy → builds config, deploys

- [x] **Step 4: Update tests**

Update `setup-wizard.test.tsx` to test engine integration.

- [x] **Step 5: Run TUI tests**

Run: `bun test packages/tui/src/components/views/setup-wizard.test.tsx`
Expected: Pass

- [x] **Step 6: Run typecheck**

Run: `bun run typecheck`
Expected: Pass

- [x] **Step 7: Commit**

```bash
git add packages/tui/src/components/views/setup-wizard.tsx packages/tui/src/components/views/setup-wizard.test.tsx
git commit -m "feat(tui): refactor SetupWizard to use shared wizard engine with config persistence"
```

---

### Task 7: Final integration & testing

- [x] **Step 1: Run full lint**

Run: `bun run lint`
Expected: Pass

- [x] **Step 2: Run full typecheck**

Run: `bun run typecheck`
Expected: Pass

- [x] **Step 3: Run all tests**

Run: `bun test`
Expected: All pass

- [x] **Step 4: Run build check**

Run: `bun run build`
Expected: Pass

- [x] **Step 5: Commit final**

```bash
git add -A && git commit -m "feat: complete shared wizard engine integration across CLI and TUI"
```
