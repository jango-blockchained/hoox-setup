# CLI Enhanced Setup & Cloudflare Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Add comprehensive CLI commands for setup validation, Cloudflare resource management, enhanced worker operations, and wizard refactoring.

**Architecture:** Modular command structure with shared Cloudflare client library. Each command group in its own file under src/commands/.

**Tech Stack:** Bun, Ink (TUI), Zod (validation)

---

## Task 1: Cloudflare API Client Library

**Files:**
- Create: `packages/hoox-cli/src/lib/cf-client.ts`
- Create: `packages/hoox-cli/src/lib/validation.ts`
- Modify: `packages/hoox-cli/src/types.ts`

- [ ] **Step 1: Create cf-client.ts with Cloudflare API wrapper**

```typescript
export interface CFConfig {
  apiToken: string;
  accountId: string;
}

export class CloudflareClient {
  private baseUrl = "https://api.cloudflare.com/client/v4";
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Implementation with auth headers
  }

  // D1 operations
  async listD1Databases(): Promise<D1Database[]>
  async createD1Database(name: string): Promise<D1Database>
  async getD1Database(id: string): Promise<D1Database>
  async deleteD1Database(id: string): Promise<void>
  async executeD1Query(dbId: string, query: string): Promise<void>

  // R2 operations
  async listR2Buckets(): Promise<R2Bucket[]>
  async createR2Bucket(name: string): Promise<R2Bucket>
  async deleteR2Bucket(name: string): Promise<void>

  // KV operations
  async listKVNamespaces(): Promise<KVNamespace[]>
  async createKVNamespace(title: string): Promise<KVNamespace>
  async deleteKVNamespace(id: string): Promise<void>
  async getKVValue(nsId: string, key: string): Promise<string | null>
  async setKVValue(nsId: string, key: string, value: string): Promise<void>
  async deleteKVKey(nsId: string, key: string): Promise<void>

  // Queues operations
  async listQueues(): Promise<Queue[]>
  async createQueue(name: string): Promise<Queue>

  // Secret Store operations
  async listSecrets(storeId: string): Promise<Secret[]>
  async getSecret(storeId: string, name: string): Promise<Secret>
  async setSecret(storeId: string, name: string, value: string): Promise<void>
  async deleteSecret(storeId: string, name: string): Promise<void>

  // Workers operations
  async listWorkers(): Promise<Worker[]>
  async getWorker(scriptName: string): Promise<Worker>
  async rollbackWorker(scriptName: string, versionId: string): Promise<void>

  // Analytics
  async getWorkerAnalytics(scriptName: string): Promise<Analytics>
}

export async function createCFClient(config: CFConfig): Promise<CloudflareClient> {
  // Factory function
}
```

- [ ] **Step 2: Create validation.ts with shared validation logic**

```typescript
import { z } from "zod";

export const DependencySchema = z.object({
  name: z.string(),
  version: z.string(),
  required: z.boolean(),
});

export const ConfigValidationSchema = z.object({
  global: GlobalConfigSchema,
  workers: WorkerConfigMapSchema,
});

// Validation functions
export async function validateDependencies(): Promise<ValidationResult>
export async function validateAuth(token: string, accountId: string): Promise<ValidationResult>
export function validateConfig(config: unknown): ValidationResult
export async function validateWorkers(workers: WorkerConfigMap): Promise<ValidationResult>
export async function validateResources(config: Config): Promise<ValidationResult>
```

- [ ] **Step 3: Update types.ts with new types**

Add Cloudflare API response types: D1Database, R2Bucket, KVNamespace, Queue, Secret, Worker, Analytics.

- [ ] **Step 4: Test client creation**

```typescript
// packages/hoox-cli/test/cf-client.test.ts
import { describe, expect, test } from "vitest";
import { CloudflareClient } from "../src/lib/cf-client.js";

test("creates client with config", () => {
  const client = new CloudflareClient({
    apiToken: "test-token",
    accountId: "test-account",
  });
  expect(client).toBeDefined();
});
```

Run: `cd packages/hoox-cli && bun test test/cf-client.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/hoox-cli/src/lib packages/hoox-cli/test/cf-client.test.ts
git commit -m "feat: add Cloudflare API client library"
```

---

## Task 2: Setup Commands (validate, repair, export)

**Files:**
- Create: `packages/hoox-cli/src/commands/setup.ts`
- Modify: `packages/hoox-cli/bin/hoox.ts`

- [ ] **Step 1: Create setup.ts with setup subcommands**

```typescript
import { CloudflareClient } from "../lib/cf-client.js";
import { 
  validateDependencies, 
  validateAuth, 
  validateConfig,
  validateWorkers,
  validateResources 
} from "../lib/validation.js";
import { loadConfig } from "../configUtils.js";

export async function setupValidate(verbose: boolean, fix: boolean) {
  console.log("Running pre-flight validation...\n");
  
  // Check dependencies
  const depsResult = await validateDependencies();
  if (!depsResult.success) {
    if (fix) await fixDependencies();
    else throw new Error("Dependencies failed");
  }
  
  // Check auth
  const config = await loadConfig();
  const authResult = await validateAuth(
    config.global.cloudflare_api_token,
    config.global.cloudflare_account_id
  );
  if (!authResult.success) throw new Error("Auth failed");
  
  // Check config
  const configResult = validateConfig(config);
  if (!configResult.success) throw new Error("Config invalid");
  
  // Check workers
  const workersResult = await validateWorkers(config.workers);
  if (!workersResult.success) throw new Error("Workers invalid");
  
  // Check resources
  const resourcesResult = await validateResources(config);
  if (!resourcesResult.success) {
    if (fix) await repairResources(config);
    else throw new Error("Resources failed");
  }
  
  console.log("✅ All validations passed");
}

export async function setupRepair() {
  console.log("Running repair...\n");
  // Re-provision submodules
  // Fix broken bindings
  // Re-run D1 migrations
  // Update wrangler configs
}

export async function setupExport() {
  console.log("Exporting configuration...\n");
  // JSON export
  // Environment template
  // Secrets checklist
}
```

- [ ] **Step 2: Test setup commands**

```typescript
// packages/hoox-cli/test/setup.test.ts
test("setup validate throws without config", async () => {
  await expect(setupValidate(false, false)).rejects.toThrow();
});
```

Run: `cd packages/hoox-cli && bun test test/setup.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/hoox-cli/src/commands/setup.ts
git commit -m "feat: add setup validate, repair, export commands"
```

---

## Task 3: Cloudflare D1 Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/cf/d1.ts`
- Modify: `packages/hoox-cli/bin/hoox.ts`

- [ ] **Step 1: Create cf/d1.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";

export async function listD1Databases(client: CloudflareClient) {
  const dbs = await client.listD1Databases();
  console.log("D1 Databases:");
  dbs.forEach(db => console.log(`  - ${db.title} (${db.uuid})`));
}

export async function createD1Database(client: CloudflareClient, name: string) {
  const db = await client.createD1Database(name);
  console.log(`Created D1 database: ${db.title}`);
}

export async function migrateD1Database(
  client: CloudflareClient,
  workerName: string,
  dbName: string
) {
  // Run migrations for worker
}

export async function backupD1(
  client: CloudflareClient,
  dbName: string
) {
  const backup = await client.backupD1Database(dbName);
  console.log(`Created backup: ${backup.id}`);
}

export async function restoreD1(
  client: CloudflareClient,
  dbName: string,
  backupId: string
) {
  await client.restoreD1Database(dbName, backupId);
  console.log("Database restored successfully");
}
```

- [ ] **Step 2: Test D1 commands**

Write tests in `packages/hoox-cli/test/cf-d1.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/hoox-cli/src/commands/cf/d1.ts
git commit -m "feat: add Cloudflare D1 management commands"
```

---

## Task 4: Cloudflare R2 Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/cf/r2.ts`

- [ ] **Step 1: Create cf/r2.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";

export async function listR2Buckets(client: CloudflareClient) {
  const buckets = await client.listR2Buckets();
  console.log("R2 Buckets:");
  buckets.forEach(b => console.log(`  - ${b.name}`));
}

export async function createR2Bucket(client: CloudflareClient, name: string) {
  const bucket = await client.createR2Bucket(name);
  console.log(`Created bucket: ${bucket.name}`);
}

export async function configureR2Lifecycle(
  client: CloudflareClient,
  bucketName: string,
  rules: LifecycleRule[]
) {
  // Configure lifecycle rules
}
```

- [ ] **Step 2: Test R2 commands**

Write tests in `packages/hoox-cli/test/cf-r2.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/hoox-cli/src/commands/cf/r2.ts
git commit -m "feat: add Cloudflare R2 management commands"
```

---

## Task 5: Cloudflare KV Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/cf/kv.ts`

- [ ] **Step 1: Create cf/kv.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";

export async function listKVNamespaces(client: CloudflareClient) {
  const namespaces = await client.listKVNamespaces();
  console.log("KV Namespaces:");
  namespaces.forEach(ns => console.log(`  - ${ns.title} (${ns.id})`));
}

export async function createKVNamespace(client: CloudflareClient, title: string) {
  const ns = await client.createKVNamespace(title);
  console.log(`Created KV namespace: ${ns.title}`);
}

export async function getKVValue(
  client: CloudflareClient,
  nsId: string,
  key: string
) {
  const value = await client.getKVValue(nsId, key);
  console.log(`${key} = ${value}`);
}

export async function setKVValue(
  client: CloudflareClient,
  nsId: string,
  key: string,
  value: string
) {
  await client.setKVValue(nsId, key, value);
  console.log(`Set ${key} in namespace ${nsId}`);
}

export async function deleteKVKey(
  client: CloudflareClient,
  nsId: string,
  key: string
) {
  await client.deleteKVKey(nsId, key);
  console.log(`Deleted ${key} from namespace ${nsId}`);
}
```

- [ ] **Step 2: Test KV commands**

Write tests in `packages/hoox-cli/test/cf-kv.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/hoox-cli/src/commands/cf/kv.ts
git commit -m "feat: add Cloudflare KV management commands"
```

---

## Task 6: Cloudflare Secrets Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/cf/secrets.ts`

- [ ] **Step 1: Create cf/secrets.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";

export async function listSecrets(client: CloudflareClient, storeId: string) {
  const secrets = await client.listSecrets(storeId);
  console.log("Secrets:");
  secrets.forEach(s => console.log(`  - ${s.name}`));
}

export async function getSecretMetadata(
  client: CloudflareClient,
  storeId: string,
  name: string
) {
  const secret = await client.getSecret(storeId, name);
  console.log(`Secret: ${secret.name}`);
  console.log(`  Created: ${secret.created}`);
  console.log(`  Version: ${secret.version}`);
}

export async function setSecretValue(
  client: CloudflareClient,
  storeId: string,
  name: string,
  value: string
) {
  await client.setSecret(storeId, name, value);
  console.log(`Set secret: ${name}`);
}

export async function deleteSecret(
  client: CloudflareClient,
  storeId: string,
  name: string
) {
  await client.deleteSecret(storeId, name);
  console.log(`Deleted secret: ${name}`);
}
```

- [ ] **Step 2: Test secrets commands**

Write tests in `packages/hoox-cli/test/cf-secrets.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/hoox-cli/src/commands/cf/secrets.ts
git commit -m "feat: add Cloudflare Secret Store commands"
```

---

## Task 7: Cloudflare Queues Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/cf/queues.ts`

- [ ] **Step 1: Create cf/queues.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";

export async function listQueues(client: CloudflareClient) {
  const queues = await client.listQueues();
  console.log("Queues:");
  queues.forEach(q => console.log(`  - ${q.queue_name}`));
}

export async function createQueue(client: CloudflareClient, name: string) {
  const queue = await client.createQueue(name);
  console.log(`Created queue: ${queue.queue_name}`);
}

export async function configureQueue(
  client: CloudflareClient,
  queueName: string,
  options: QueueOptions
) {
  await client.configureQueue(queueName, options);
  console.log(`Configured queue: ${queueName}`);
}
```

- [ ] **Step 2: Test queues commands**

Write tests in `packages/hoox-cli/test/cf-queues.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/hoox-cli/src/commands/cf/queues.ts
git commit -m "feat: add Cloudflare Queues commands"
```

---

## Task 8: Cloudflare Zones/DNS Commands

**Files:**
- Create: `packages/hoox-cli/src/commands/cf/zones.ts`

- [ ] **Step 1: Create cf/zones.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";

export async function listZones(client: CloudflareClient) {
  const zones = await client.listZones();
  console.log("Zones:");
  zones.forEach(z => console.log(`  - ${z.name} (${z.status})`));
}

export async function listDNSRecords(client: CloudflareClient, zoneId: string) {
  const records = await client.listDNSRecords(zoneId);
  console.log("DNS Records:");
  records.forEach(r => console.log(`  ${r.type} ${r.name} -> ${r.content}`));
}

export async function addDNSRecord(
  client: CloudflareClient,
  zoneId: string,
  record: DNSRecord
) {
  const result = await client.addDNSRecord(zoneId, record);
  console.log(`Added DNS record: ${record.name}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/hoox-cli/src/commands/cf/zones.ts
git commit -m "feat: add Cloudflare Zones/DNS commands"
```

---

## Task 9: Workers Repair Command

**Files:**
- Create: `packages/hoox-cli/src/commands/workers/repair.ts`
- Modify: `packages/hoox-cli/src/workerCommands.ts` (reuse logic)

- [ ] **Step 1: Create workers/repair.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";
import { setupWorkers } from "../../workerCommands.js";

export async function repairWorker(workerName?: string) {
  const config = await loadConfig();
  const client = new CloudflareClient({
    apiToken: config.global.cloudflare_api_token,
    accountId: config.global.cloudflare_account_id,
  });
  
  const workers = workerName 
    ? { [workerName]: config.workers[workerName] }
    : config.workers;
    
  for (const [name, workerConfig] of Object.entries(workers)) {
    if (!workerConfig.enabled) continue;
    console.log(`Repairing worker: ${name}`);
    
    // Rebuild bindings
    // Verify/set D1 bindings
    // Verify/set R2 bindings
    // Verify/set KV bindings
    // Verify/set secrets
  }
  
  console.log("Worker repair complete");
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/hoox-cli/src/commands/workers/repair.ts
git commit -m "feat: add workers repair command"
```

---

## Task 10: Workers Logs Command

**Files:**
- Create: `packages/hoox-cli/src/commands/workers/logs.ts`

- [ ] **Step 1: Create workers/logs.ts**

```typescript
import { spawn } from "node:child_process";
import { CloudflareClient } from "../../lib/cf-client.js";

export async function tailLogs(
  workerName?: string,
  options: { level?: string; follow?: boolean } = {}
) {
  const args = ["wrangler", "tail"];
  
  if (workerName) args.push("--worker", workerName);
  if (options.level) args.push("--level", options.level);
  if (options.follow) args.push("--follow");
  
  const proc = spawn("bunx", args, { stdio: "inherit" });
  
  proc.on("exit", (code) => process.exit(code || 0));
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/hoox-cli/src/commands/workers/logs.ts
git commit -m "feat: add workers logs tail command"
```

---

## Task 11: Workers Metrics Command

**Files:**
- Create: `packages/hoox-cli/src/commands/workers/metrics.ts`

- [ ] **Step 1: Create workers/metrics.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";

export async function workerMetrics(workerName: string) {
  const analytics = await client.getWorkerAnalytics(workerName);
  
  console.log(`\nMetrics for ${workerName}:`);
  console.log(`  Requests: ${analytics.requests.total}`);
  console.log(`  Data Transfer: ${analytics.dataTransfer}MB`);
  console.log(`  Avg Response Time: ${analytics.responseTime}ms`);
  console.log(`  Error Rate: ${analytics.errors}%`);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/hoox-cli/src/commands/workers/metrics.ts
git commit -m "feat: add workers metrics command"
```

---

## Task 12: Workers Rollback Command

**Files:**
- Create: `packages/hoox-cli/src/commands/workers/rollback.ts`

- [ ] **Step 1: Create workers/rollback.ts**

```typescript
import { CloudflareClient } from "../../lib/cf-client.js";
import { rl } from "../../utils.js";

export async function rollbackWorker(workerName: string, version?: string) {
  const client = await createCFClient();
  const versions = await client.getWorkerVersions(workerName);
  
  if (!version) {
    console.log(`Available versions for ${workerName}:`);
    versions.forEach((v, i) => {
      console.log(`${i + 1}. ${v.version} - ${v.deployed_at}`);
    });
    const selection = await rl.question("Select version number: ");
    version = versions[parseInt(selection) - 1].version;
  }
  
  await client.rollbackWorker(workerName, version);
  console.log(`Rolled back to version: ${version}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/hoox-cli/src/commands/workers/rollback.ts
git commit -m "feat: add workers rollback command"
```

---

## Task 13: Enhanced Wizard Refactoring

**Files:**
- Create: `packages/hoox-cli/src/wizard/steps/`
- Create: `packages/hoox-cli/src/wizard/hooks/`
- Modify: `packages/hoox-cli/src/wizard.ts`
- Modify: `packages/hoox-cli/src/wizardSteps.ts`

- [ ] **Step 1: Create wizard directory structure**

```typescript
// packages/hoox-cli/src/wizard/steps/index.ts
export { validateDependencies } from "./validateDependencies.js";
export { configureGlobals } from "./configureGlobals.js";
export { selectWorkers } from "./selectWorkers.js";
export { provisionResources } from "./provisionResources.js";
export { manageSecrets } from "./manageSecrets.js";
export { previewConfig } from "./previewConfig.js";
export { deployWorkers } from "./deployWorkers.js";
export { verifyDeployment } from "./verifyDeployment.js";

// packages/hoox-cli/src/wizard/hooks/index.ts
export { useValidation } from "./useValidation.js";
export { useAutoSave } from "./useAutoSave.js";
export { useVerboseLogging } from "./useVerboseLogging.js";
```

- [ ] **Step 2: Refactor wizard.ts with new structure**

- Add dry-run mode
- Add verbose logging flag
- Add state persistence
- Add resume from any step

- [ ] **Step 3: Add new validation hooks**

```typescript
export function useValidation(step: string) {
  // Validate before/after each step
  // Auto-fix when possible
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/hoox-cli/src/wizard/
git commit -m "refactor: enhance wizard with modular steps and validation hooks"
```

---

## Task 14: Command Router & Main Entry

**Files:**
- Modify: `packages/hoox-cli/bin/hoox.ts`

- [ ] **Step 1: Wire up all commands in hoox.ts**

```typescript
import { setupValidate, setupRepair, setupExport } from "./commands/setup.js";
import { listD1Databases, createD1Database } from "./commands/cf/d1.js";
import { listR2Buckets, createR2Bucket } from "./commands/cf/r2.js";
// ... all other imports

const command = process.argv[2];
const subcommand = process.argv[3];

switch (command) {
  case "setup":
    switch (subcommand) {
      case "validate": await setupValidate(...); break;
      case "repair": await setupRepair(); break;
      case "export": await setupExport(); break;
    }
    break;
  // ... other commands
}
```

- [ ] **Step 2: Test all commands work**

Run integration tests for all new commands.

- [ ] **Step 3: Commit**

```bash
git add packages/hoox-cli/bin/hoox.ts
git commit -m "feat: wire up all new CLI commands"
```

---

## Task 15: Background Tasks (Housekeeping Cron)

**Files:**
- Modify: `workers/agent-worker/src/index.ts`

- [ ] **Step 1: Enhance agent-worker with comprehensive monitoring**

```typescript
// Enhanced housekeeping tasks
async function runHousekeeping() {
  // Portfolio balance checks
  // Position health validation
  // Worker uptime monitoring
  // D1 backup verification
  // Send alerts on failures
}
```

- [ ] **Step 2: Commit**

```bash
git add workers/agent-worker/src/
git commit -m "feat: enhance housekeeping cron with comprehensive monitoring"
```

---

## Plan Summary

| Task | Component | Files |
|------|-----------|-------|
| 1 | Cloudflare Client | 3 files |
| 2 | Setup Commands | 2 files |
| 3 | D1 Commands | 1 file |
| 4 | R2 Commands | 1 file |
| 5 | KV Commands | 1 file |
| 6 | Secrets Commands | 1 file |
| 7 | Queues Commands | 1 file |
| 8 | Zones Commands | 1 file |
| 9 | Worker Repair | 1 file |
| 10 | Worker Logs | 1 file |
| 11 | Worker Metrics | 1 file |
| 12 | Worker Rollback | 1 file |
| 13 | Wizard Refactor | Multiple |
| 14 | Command Router | 1 file |
| 15 | Background Tasks | 1 file |

**Total: ~20 new files**

---

## Execution Approach

**Subagent-Driven (recommended):** Each task is self-contained and can be implemented by a subagent. I'll dispatch one subagent per task, review output, then proceed to the next.

**Which approach do you prefer?**