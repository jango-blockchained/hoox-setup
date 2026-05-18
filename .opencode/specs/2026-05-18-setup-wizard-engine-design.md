# Setup Wizard Engine — Design Document

> **Date:** 2026-05-18
> **Status:** Approved for implementation

## Problem

The project has two setup wizards (CLI `hoox init` and TUI SetupWizard view) but both are incomplete compared to the original bash wizard:

1. No Cloudflare infrastructure provisioning (D1/KV/R2/Queues)
2. TUI SetupWizard collects form data but doesn't persist to `wrangler.jsonc`
3. No worker presets with dependency resolution
4. No state save/resume
5. Duplicated logic between CLI and TUI implementations

## Solution

Create a shared wizard engine in `packages/shared/src/wizard/` that both CLI and TUI consume as thin UI wrappers. The engine is pure logic — no Node/Bun APIs — so it remains compatible with Cloudflare Workers.

## Architecture

```
@jango-blockchained/hoox-shared/wizard
├── types.ts           — WizardStep, WizardState, Preset, ProvisioningPlan
├── engine.ts          — State machine: step navigation, validation, config building
├── presets.ts         — Worker templates + dependency resolution
├── provisioner.ts     — Interface for Cloudflare infra provisioning (D1/KV/R2)
├── persistence.ts     — State serialization + file I/O interface
└── index.ts           — Re-exports

@jango-blockchained/hoox-cli
└── commands/init/
    ├── init-command.ts  — Uses engine + @clack/prompts (thin UI wrapper)
    ├── cli-provisioner.ts — Implements Provisioner via wrangler CLI (Bun.spawn)
    └── types.ts          — CLI-specific types

@jango-blockchained/hoox-tui
└── components/views/
    └── setup-wizard.tsx  — Uses engine + OpenTUI React (thin UI wrapper)
```

### Key Design Decisions

1. **Engine is pure logic** — no UI, no I/O (except through interfaces). Uses dependency injection for side effects.
2. **Provisioner Interface** — `packages/shared` defines the interface, CLI implements via `Bun.spawn("wrangler")`, TUI via CliBridge
3. **State Machine** — The engine is a simple state machine with 8 steps:
   - `PREREQUISITES → CLOUDFLARE_CONFIG → WORKER_SELECTION → PROVISIONING → SECRETS → CONFIG_WRITE → DEPLOY → DONE`
4. **Cloudflare Worker compatibility** — Engine code avoids `node:*`, `Bun.*`, or any Node/Bun-specific APIs. File I/O is abstracted behind an interface.
5. **No new dependencies** — Uses existing packages (typescript, no zod needed for engine itself)

## Engine Specification

### WizardEngine Class

```typescript
class WizardEngine {
  constructor(initialState?: Partial<WizardState>);

  // State access
  getState(): WizardState;
  getCurrentStep(): StepDefinition;
  getCompletedSteps(): StepId[];

  // Navigation
  canProceed(): boolean;
  canGoBack(): boolean;
  execute(input: unknown): string[]; // returns validation errors, advances step
  goBack(): void;
  reset(): void;

  // Output
  buildConfig(): WorkersJsonConfig;
  getProvisioningPlan(): ProvisioningPlan;
}
```

### WizardState

```typescript
interface WizardState {
  step: StepId;
  completedSteps: StepId[];
  cloudflareConfig?: {
    apiToken: string;
    accountId: string;
    secretStoreId: string;
    subdomain: string;
  };
  selectedWorkers: string[];
  selectedIntegrations: string[];
  secrets: Record<string, Record<string, string>>;
  preset?: string;
  provisioningResults?: ProvisionResult;
  startedAt: number;
  updatedAt: number;
}
```

### Steps

| Step              | Label             | Optional | Can Go Back | Validates                    |
| ----------------- | ----------------- | -------- | ----------- | ---------------------------- |
| PREREQUISITES     | Prerequisites     | No       | No          | System tools present         |
| CLOUDFLARE_CONFIG | Cloudflare Config | No       | Yes         | API token, account ID format |
| WORKER_SELECTION  | Worker Selection  | No       | Yes         | At least 1 worker selected   |
| PROVISIONING      | Provisioning      | Yes      | Yes         | —                            |
| SECRETS           | Secrets           | No       | Yes         | Required secrets filled      |
| CONFIG_WRITE      | Config Write      | No       | Yes         | Config file writable         |
| DEPLOY            | Deploy            | Yes      | No          | —                            |
| DONE              | Complete          | No       | No          | —                            |

## Provisioning

### ProvisioningPlan

```typescript
interface ProvisioningPlan {
  d1Databases: string[];
  kvNamespaces: string[];
  r2Buckets: string[];
  queues: string[];
}

interface ProvisionResult {
  success: boolean;
  created: string[];
  errors: string[];
}
```

### Provisioner Interface

```typescript
interface Provisioner {
  provision(plan: ProvisioningPlan): Promise<ProvisionResult>;
  check(plan: ProvisioningPlan): Promise<ProvisionResult>; // dry-run
}
```

## Worker Presets

Three presets with auto-dependency resolution:

| Preset       | Workers                                                          | Integrations                                   |
| ------------ | ---------------------------------------------------------------- | ---------------------------------------------- |
| **Minimal**  | hoox, d1-worker, analytics-worker                                | —                                              |
| **Standard** | hoox, d1-worker, trade-worker, analytics-worker, telegram-worker | binance, telegram                              |
| **Full**     | All workers + AI agent + DeFi                                    | binance, bybit, mexc, telegram, openai, wallet |

Dependencies are resolved transitively using:

```typescript
const WORKER_DEPENDENCIES: Record<string, string[]> = {
  "trade-worker": ["d1-worker"],
  "agent-worker": ["d1-worker"],
  "email-worker": ["d1-worker"],
  "analytics-worker": ["d1-worker"],
  "web3-wallet-worker": ["d1-worker", "hoox"],
};
```

## Persistence

State is saved/loaded via injectable file system interface:

```typescript
interface WizardFileSystem {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
```

Default path: `~/.hoox/wizard-state.json`

## Migration Path

1. Create `packages/shared/src/wizard/` modules (types, engine, presets, provisioner, persistence)
2. Refactor `packages/cli/src/commands/init/init-command.ts` to use engine
3. Add `cli-provisioner.ts`
4. Refactor TUI SetupWizard to use engine + add config save
5. Add state persistence to both
6. Final integration testing

## Constraints

- **No `node:*` or `Bun.*`** in shared engine code
- **Existing `INTEGRATIONS` config** moves to shared package (currently in CLI `types.ts`)
- **TUI uses CliBridge** for side effects (provisioning, deploy) rather than direct `Bun.spawn`
- **Zod** only used if validation schemas need to be shared — engine can use plain TypeScript validators
- **State file** follows existing `~/.hoox/` config directory convention
