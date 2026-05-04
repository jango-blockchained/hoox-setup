# Hoox CLI Refactoring Design

**Date:** 2026-05-04
**Status:** Approved
**Scope:** Full refactoring of `packages/hoox-cli` into a modular, layered architecture

## 1. Architecture Overview

The refactored CLI uses a **4-layer architecture** with strict boundaries and a **Layered Pattern** integrating Command, Observer, and Engine patterns:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI ENTRY POINT                           │
│              (src/index.ts, src/cli/)                       │
│  - Parse argv, load commands, initialize layers             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    UI LAYER (Clack)                         │
│         src/commands/*/  (each command uses Clack)          │
│  - Only emits events, no business logic                      │
│  - Imports: @clack/prompts, CommandContext                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ emits events
┌──────────────────────▼──────────────────────────────────────┐
│              OBSERVER / STATE LAYER                         │
│              src/core/observer.ts                           │
│  - Central state store (CLI state, worker health, system)  │
│  - Event emitter for state changes                          │
│  - getState(), setState(), subscribe(), emit()              │
└──────────────────────┬──────────────────────────────────────┘
                       │ state changes
┌──────────────────────▼──────────────────────────────────────┐
│                    ENGINE LAYER                              │
│              src/core/engine.ts                             │
│  - Subscribes to observer state changes                     │
│  - Contains business logic (deploy, configure, etc.)        │
│  - Calls adapters for external operations                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    ADAPTERS LAYER                           │
│              src/adapters/                                   │
│  - cloudflare.ts (Wrangler API)                            │
│  - bun.ts (Bun.password, Bun.file, Bun.sqlite)            │
│  - workers.ts (Service bindings, inter-worker calls)        │
└─────────────────────────────────────────────────────────────┘
```

### Key Rules

1. **UI Layer** → ONLY emits events, uses Clack for prompts
2. **Observer** → Pure state management, no side effects
3. **Engine** → Business logic only, no Clack imports
4. **Adapters** → External service wrappers, Bun-native where possible

### Data Flow Example (hoox trade:deploy)

1. User runs `hoox trade:deploy`
2. `src/commands/trade/deploy.ts` → Clack prompts for confirmation → `observer.emit('command:start', {cmd: 'trade:deploy'})`
3. Observer updates state → `engine` subscriber fires → `engine.deployTradeWorker()`
4. Engine calls `adapters/cloudflare.ts` → `wrangler deploy workers/trade-worker`
5. Engine calls `adapters/bun.ts` → `Bun.password()` for API keys if needed
6. Observer state updates → `{ deploymentStatus: 'success', lastDeployed: Date }`

---

## 2. Directory Structure

```
packages/hoox-cli/src/
├── index.ts                    # Entry point (thin, just bootstraps)
├── cli/
│   ├── loader.ts              # Folder-based command loader
│   ├── registry.ts            # Command registry (maps names to classes)
│   └── context.ts             # CommandContext factory
├── core/
│   ├── observer.ts            # Central state store + event emitter
│   ├── engine.ts              # Business logic orchestrator
│   ├── errors.ts              # CLI-specific error classes
│   └── types.ts              # Core interfaces (Command, Observer, Engine)
├── adapters/
│   ├── cloudflare.ts         # Wrangler API wrapper
│   ├── bun.ts                # Bun.password, Bun.file, Bun.sqlite
│   └── workers.ts            # Service bindings, inter-worker calls
├── commands/
│   ├── trade/
│   │   ├── deploy.ts         # hoox trade:deploy
│   │   ├── logs.ts           # hoox trade:logs
│   │   └── config.ts        # hoox trade:config
│   ├── config/
│   │   ├── init.ts           # hoox config:init
│   │   ├── secrets.ts       # hoox config:secrets
│   │   └── export.ts        # hoox config:export
│   ├── workers/
│   │   ├── list.ts           # hoox workers:list
│   │   ├── deploy.ts         # hoox workers:deploy
│   │   └── rollback.ts      # hoox workers:rollback
│   ├── cf/
│   │   ├── d1.ts            # hoox cf:d1
│   │   ├── r2.ts            # hoox cf:r2
│   │   └── waf.ts           # hoox cf:waf
│   ├── dashboard/
│   │   └── deploy.ts        # hoox dashboard:deploy
│   └── wizard/
│       ├── run.ts            # hoox wizard (replaces old wizard.ts)
│       └── steps/           # Reusable wizard steps
│           ├── dependencies.ts
│           ├── globals.ts
│           └── workers.ts
├── utils/
│   ├── logger.ts             # Shared logging (replaces ansis scattered usage)
│   └── validation.ts        # Zod schemas for CLI args
└── types.ts                  # Re-exported types (Config, WizardState, etc.)
```

### Naming Convention

- **Folder structure maps to command names**: `src/commands/trade/deploy.ts` → `trade:deploy`
- **Hierarchical naming**: `trade:deploy`, `trade:logs`, `config:init`, `workers:list`
- **Nested by domain**: Commands grouped by folder matching their namespace

---

## 3. Key Interfaces

### Core Types (src/core/types.ts)

```typescript
// Command Pattern Interface
export interface CommandContext {
  observer: Observer;
  engine: Engine;
  adapters: {
    cloudflare: CloudflareAdapter;
    bun: BunAdapter;
    workers: WorkersAdapter;
  };
  cwd: string;
  args?: Record<string, unknown>;
}

export interface Command {
  name: string;           // e.g., 'trade:deploy'
  description: string;
  options?: CommandOption[];
  execute(ctx: CommandContext): Promise<void>;
}

export interface CommandOption {
  flag: string;
  short?: string;
  type: 'string' | 'boolean';
  description?: string;
  default?: string | boolean;
}

// Observer Pattern Interface
export interface Observer {
  getState(): AppState;
  setState(partial: Partial<AppState>): void;
  subscribe(listener: StateListener): UnsubscribeFn;
  emit(event: string, data?: unknown): void;
  on(event: string, handler: EventHandler): UnsubscribeFn;
}

export type StateListener = (state: AppState) => void;
export type EventHandler = (data: unknown) => void;
export type UnsubscribeFn = () => void;

export interface AppState {
  // CLI State
  currentCommand?: string;
  commandStatus: 'idle' | 'running' | 'success' | 'error';
  lastError?: CLIError;
  
  // Worker State (comprehensive monitoring)
  workers: Record<string, WorkerHealth>;
  
  // System State (comprehensive as requested)
  system: {
    bunVersion: string;
    memoryUsage: NodeJS.MemoryUsage;
    cloudflareQuota?: { remaining: number; limit: number };
    apiRateLimits?: Record<string, { remaining: number; resetAt: Date }>;
  };
  
  // Wizard State (reuse existing WizardState)
  wizard?: WizardState;
}

export interface WorkerHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastDeployed?: string;
  errorRate?: number;
  responseTime?: number;
}

// Engine Interface
export interface Engine {
  initialize(): Promise<void>;
  // Subscribes to observer events and routes to handlers
  startListening(): void;
  stopListening(): void;
}
```

---

## 4. Core Implementation Patterns

### Observer Implementation (src/core/observer.ts)

```typescript
import { EventEmitter } from 'node:events';
import type { AppState, Observer, StateListener, EventHandler, UnsubscribeFn } from './types.js';

export class AppObserver implements Observer {
  private state: AppState;
  private emitter = new EventEmitter();
  private listeners: Set<StateListener> = new Set();

  constructor(initialState?: Partial<AppState>) {
    this.state = {
      commandStatus: 'idle',
      workers: {},
      system: {
        bunVersion: Bun.version,
        memoryUsage: process.memoryUsage(),
      },
      ...initialState,
    };
  }

  getState(): AppState {
    return structuredClone(this.state); // Prevent external mutation
  }

  setState(partial: Partial<AppState>): void {
    const prev = this.state;
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => fn(this.state));
    this.emitter.emit('state:change', { prev, next: this.state });
  }

  subscribe(listener: StateListener): UnsubscribeFn {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: string, data?: unknown): void {
    this.emitter.emit(event, data);
  }

  on(event: string, handler: EventHandler): UnsubscribeFn {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  // System monitoring (called periodically)
  updateSystemMetrics(): void {
    this.setState({
      system: {
        ...this.state.system,
        memoryUsage: process.memoryUsage(),
      },
    });
  }
}
```

### Engine Implementation (src/core/engine.ts)

```typescript
import type { Engine, CommandContext, AppState } from './types.js';
import { CLIError } from './errors.js';

export class AppEngine implements Engine {
  private observer: import('./types.js').Observer;
  private adapters: CommandContext['adapters'];
  private unsubs: (() => void)[] = [];

  constructor(observer: import('./types.js').Observer, adapters: CommandContext['adapters']) {
    this.observer = observer;
    this.adapters = adapters;
  }

  async initialize(): Promise<void> {
    // Initialize adapters (e.g., test Cloudflare API connection)
    await this.adapters.cloudflare.testConnection();
  }

  startListening(): void {
    // Subscribe to command events
    const unsub1 = this.observer.on('command:start', async (data) => {
      const { cmd, args } = data as { cmd: string; args: Record<string, unknown> };
      await this.handleCommand(cmd, args);
    });

    // Subscribe to state changes (e.g., worker health alerts)
    const unsub2 = this.observer.subscribe((state: AppState) => {
      if (state.commandStatus === 'error') {
        this.handleError(state);
      }
    });

    // Periodic system metrics
    const interval = setInterval(() => {
      this.observer.updateSystemMetrics();
    }, 30000); // Every 30s

    this.unsubs = [unsub1, unsub2, () => clearInterval(interval)];
  }

  stopListening(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
  }

  private async handleCommand(cmd: string, args: Record<string, unknown>): Promise<void> {
    this.observer.setState({ currentCommand: cmd, commandStatus: 'running' });
    
    try {
      // Route to appropriate handler based on command name
      if (cmd.startsWith('trade:')) {
        await this.handleTradeCommand(cmd, args);
      } else if (cmd.startsWith('workers:')) {
        await this.handleWorkersCommand(cmd, args);
      }
      // ... more routing
      
      this.observer.setState({ commandStatus: 'success' });
    } catch (error) {
      this.observer.setState({ commandStatus: 'error' });
      this.observer.emit('command:error', { cmd, error });
    }
  }

  private async handleTradeCommand(cmd: string, args: Record<string, unknown>): Promise<void> {
    if (cmd === 'trade:deploy') {
      await this.adapters.cloudflare.deployWorker('trade-worker');
    }
  }

  private handleError(state: AppState): void {
    if (state.lastError) {
      console.error('Command failed:', state.lastError.message);
    }
  }
}
```

### Sample Command (src/commands/trade/deploy.ts)

```typescript
import * as p from '@clack/prompts';
import type { Command, CommandContext } from '../../core/types.js';

export class TradeDeployCommand implements Command {
  name = 'trade:deploy';
  description = 'Deploy the trade-worker to Cloudflare';
  options = [
    { flag: 'force', short: 'f', type: 'boolean' as const, description: 'Force redeploy' },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    // UI Layer: Only Clack prompts, emit events
    const confirmed = await p.confirm({
      message: 'Deploy trade-worker to Cloudflare?',
      initialValue: false,
    });

    if (p.isCancel(confirmed)) {
      p.cancel('Deployment cancelled.');
      return;
    }

    if (!confirmed) return;

    // Emit event, let Engine handle execution
    ctx.observer.emit('command:start', {
      cmd: this.name,
      args: { force: ctx.args?.force },
    });

    // Show spinner while Engine works (state change will trigger UI update)
    const spinner = p.spinner();
    spinner.start('Deploying trade-worker...');

    // Wait for state to change to success/error
    await new Promise<void>((resolve) => {
      const unsub = ctx.observer.subscribe((state) => {
        if (state.commandStatus === 'success') {
          spinner.stop('Trade-worker deployed successfully!');
          unsub();
          resolve();
        } else if (state.commandStatus === 'error') {
          spinner.stop('Deployment failed.', 1);
          unsub();
          resolve();
        }
      });
    });
  }
}
```

### Folder-Based Command Loader (src/cli/loader.ts)

```typescript
import glob from 'glob';
import path from 'path';
import type { Command } from '../core/types.js';

// Automatically discovers commands from src/commands/**/*.ts
// Naming convention: folder structure → command name
// src/commands/trade/deploy.ts → 'trade:deploy'
// src/commands/config/init.ts → 'config:init'

export async function loadCommands(): Promise<Record<string, Command>> {
  const commands: Record<string, Command> = {};
  const commandDir = path.resolve(import.meta.dir, '../commands');
  
  // Recursively find all .ts files in commands/
  const files = await glob('**/*.ts', { cwd: commandDir, ignore: '**/*.test.ts' });
  
  for (const file of files) {
    const fullPath = path.join(commandDir, file);
    const mod = await import(fullPath);
    
    if (mod.default && 'execute' in mod.default) {
      // Derive command name from file path: trade/deploy.ts → trade:deploy
      const commandName = file
        .replace(/\.ts$/, '')
        .replace(/\/index$/, '')
        .replace(/\//g, ':');
      
      commands[commandName] = mod.default;
    }
  }
  
  return commands;
}
```

---

## 5. Entry Point & Error Handling

### Entry Point (src/index.ts)

```typescript
import ansis from 'ansis';
import { loadCommands } from './cli/loader.js';
import { CommandRegistry } from './cli/registry.js';
import { AppObserver } from './core/observer.js';
import { AppEngine } from './core/engine.js';
import { CloudflareAdapter } from './adapters/cloudflare.js';
import { BunAdapter } from './adapters/bun.js';
import { WorkersAdapter } from './adapters/workers.js';
import type { CommandContext } from './core/types.js';

function printBanner(): void {
  const d = ansis.dim;
  const b = ansis.bold;
  const y = ansis.yellow;
  const c = ansis.cyan;

  console.log("");
  console.log(d("  ╭─────────────────────────────────────────────────╮"));
  console.log(d("  │") + b(y("  ⚡ HOOX")) + d("  ─  Edge-Executed Trading System    ") + d("│"));
  console.log(d("  ╰─────────────────────────────────────────────────╯"));
  console.log("");
  console.log(b("  USAGE"));
  console.log(d("  $ ") + "hoox" + d(" <command> [options]"));
  console.log("");
  console.log(d("  Run ") + c("hoox <command> --help") + d(" for detailed usage"));
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printBanner();
    process.exit(0);
  }
  if (args[0] === '--version' || args[0] === '-V') {
    const pkg = await Bun.file(import.meta.dir + '/../package.json').json();
    console.log(pkg.version);
    process.exit(0);
  }

  // Initialize layers
  const observer = new AppObserver();
  const adapters = {
    cloudflare: new CloudflareAdapter(),
    bun: new BunAdapter(),
    workers: new WorkersAdapter(),
  };
  const engine = new AppEngine(observer, adapters);

  await engine.initialize();

  // Load commands via folder-based loader
  const commands = await loadCommands();
  const registry = new CommandRegistry(commands);

  // Build context for commands
  const ctx: CommandContext = {
    observer,
    engine,
    adapters,
    cwd: process.cwd(),
    args: parseArgs(args.slice(1)),
  };

  // Start engine listeners
  engine.startListening();

  // Route to command
  const [cmdName, ...cmdArgs] = args;
  const command = registry.get(cmdName);

  if (!command) {
    console.error(ansis.red(`Unknown command: ${cmdName}`));
    console.error(ansis.dim(`Run "hoox --help" to see available commands.`));
    process.exit(1);
  }

  // Emit command start, execute
  observer.emit('command:start', { cmd: cmdName, args: cmdArgs });
  
  try {
    await command.execute(ctx);
  } catch (error) {
    observer.setState({ commandStatus: 'error' });
    observer.emit('command:error', { cmd: cmdName, error });
    
    if (error instanceof Error) {
      console.error(ansis.red(`✖ ${error.message}`));
    }
    process.exit(1);
  } finally {
    engine.stopListening();
  }
}

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error(ansis.red('Uncaught Exception:'), err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(ansis.yellow('\nInterrupted by user'));
  process.exit(0);
});

main();
```

### Error Handling Strategy (src/core/errors.ts)

```typescript
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class WorkerDeployError extends CLIError {
  constructor(worker: string, cause: Error) {
    super(`Failed to deploy ${worker}: ${cause.message}`, 'DEPLOY_FAILED');
    this.cause = cause;
  }
}

export class ConfigValidationError extends CLIError {
  constructor(field: string) {
    super(`Invalid configuration: ${field} is required`, 'CONFIG_INVALID');
  }
}
```

### Bun Adapter (src/adapters/bun.ts)

```typescript
export class BunAdapter {
  // Use Bun.password for sensitive input (API keys)
  async promptSecret(prompt: string): Promise<string> {
    return Bun.password(prompt);
  }

  // Use Bun.file for fast file I/O
  async readFile(path: string): Promise<string> {
    return Bun.file(path).text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
  }

  // Use Bun.sqlite for local state (if needed)
  openSQLite(path: string): Bun.SQL {
    return Bun.sqlite(path);
  }

  // Use Bun's built-in .env loading
  loadEnv(): Record<string, string> {
    return Bun.env;
  }
}
```

---

## 6. Summary

| Aspect | Implementation |
|--------|----------------|
| **Pattern** | Layered: UI → Observer → Engine → Adapters |
| **Command Discovery** | Folder-based loader (`src/commands/**/*.ts`) |
| **Naming** | Hierarchical: `trade:deploy`, `config:init` |
| **Observer Scope** | CLI events + Worker state + System resources |
| **UI Library** | @clack/prompts (already integrated) |
| **Runtime** | Bun (leverage Bun.password, Bun.file, Bun.sqlite) |
| **State Management** | Central AppObserver with EventEmitter |
| **Error Handling** | CLIError hierarchy, recoverable vs fatal |

This design provides a clean, scalable architecture that separates concerns, leverages Bun's native capabilities, and provides comprehensive observability across CLI, workers, and system resources.
