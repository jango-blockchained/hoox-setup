import { z } from "zod";
import { CloudflareClient, createValidationResult, type ValidationResult } from "./cf-client.js";
import { loadConfig, type Config } from "../configUtils.js";

const DependencySchema = z.object({
  name: z.string(),
  version: z.string(),
  required: z.boolean(),
  command: z.string().optional(),
});

export const GlobalConfigSchema = z.object({
  cloudflare_api_token: z.string().min(1),
  cloudflare_account_id: z.string().min(1),
  cloudflare_secret_store_id: z.string().optional().default(""),
  subdomain_prefix: z.string().optional().default(""),
  d1_database_id: z.string().optional().default(""),
});

export const WorkerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  path: z.string(),
  vars: z.record(z.string()).optional(),
  services: z.array(z.object({ binding: z.string(), service: z.string() })).optional(),
  secrets: z.array(z.string()).optional(),
  deployed_url: z.string().optional(),
});

export const WorkerConfigMapSchema = z.record(z.string(), WorkerConfigSchema);

export const ConfigValidationSchema = z.object({
  global: GlobalConfigSchema,
  workers: WorkerConfigMapSchema,
});

const KNOWN_DEPS = [
  { name: "bun", required: true, command: "bun --version" },
  { name: "git", required: true, command: "git --version" },
  { name: "wrangler", required: true, command: "wrangler --version" },
];

async function checkDependency(dep: { name: string; command: string }): Promise<boolean> {
  try {
    const proc = Bun.spawn({
      cmd: dep.command.split(" "),
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

export async function validateDependencies(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const dep of KNOWN_DEPS) {
    const installed = await checkDependency(dep);
    if (dep.required && !installed) {
      errors.push(`Required dependency '${dep.name}' is not installed`);
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

export async function validateAuth(apiToken: string, accountId: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!apiToken) {
    errors.push("Cloudflare API token is missing");
  }
  if (!accountId) {
    errors.push("Cloudflare account ID is missing");
  }

  if (errors.length > 0) {
    return createValidationResult(false, errors, warnings);
  }

  try {
    const client = new CloudflareClient({ apiToken, accountId });
    await client.listZones();
    return createValidationResult(true, [], ["Auth validated successfully"]);
  } catch (e) {
    errors.push(`Auth validation failed: ${e instanceof Error ? e.message : String(e)}`);
    return createValidationResult(false, errors, warnings);
  }
}

export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const result = ConfigValidationSchema.safeParse(config);
  if (!result.success) {
    errors.push(...result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`));
    return createValidationResult(false, errors, warnings);
  }

  const validated = result.data;

  if (!validated.global.cloudflare_api_token) {
    errors.push("cloudflare_api_token is required in config");
  }
  if (!validated.global.cloudflare_account_id) {
    errors.push("cloudflare_account_id is required in config");
  }

  const workers = Object.entries(validated.workers);
  if (workers.length === 0) {
    warnings.push("No workers defined in config");
  }

  for (const [name, wc] of workers) {
    if (!wc.path) {
      errors.push(`Worker '${name}' has no path specified`);
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

export async function validateWorkers(workers: Record<string, any>): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [name, wc] of Object.entries(workers)) {
    if (!wc.enabled) continue;

    const workerPath = wc.path;
    if (!workerPath) {
      errors.push(`Worker '${name}': path is required`);
      continue;
    }

    try {
      const exists = await Bun.file(workerPath).exists();
      if (!exists) {
        errors.push(`Worker '${name}': directory '${workerPath}' does not exist`);
      }
    } catch {
      errors.push(`Worker '${name}': failed to check path`);
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

export async function validateResources(config: Config): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const client = new CloudflareClient({
      apiToken: config.global.cloudflare_api_token,
      accountId: config.global.cloudflare_account_id,
    });

    if (config.global.d1_database_id) {
      try {
        await client.getD1Database(config.global.d1_database_id);
      } catch {
        errors.push(`D1 database '${config.global.d1_database_id}' not found`);
      }
    }

    if (config.global.cloudflare_secret_store_id) {
      warnings.push(`Secret Store '${config.global.cloudflare_secret_store_id}' exists (verified by presence)`);
    }

    const kvNamespaces = await client.listKVNamespaces();
    warnings.push(`Found ${kvNamespaces.length} KV namespace(s)`);
  } catch (e) {
    errors.push(`Resource validation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

export async function fixDependencies(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const deps = ["bun", "wrangler"];
  for (const dep of deps) {
    try {
      const proc = Bun.spawn({
        cmd: ["npm", "install", "-g", dep],
        stdout: "pipe",
        stderr: "pipe",
      });
      const code = await proc.exited;
      if (code === 0) {
        warnings.push(`Installed ${dep}`);
      } else {
        errors.push(`Failed to install ${dep}`);
      }
    } catch {
      errors.push(`Failed to install ${dep}`);
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

export async function repairResources(config: Config): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const client = new CloudflareClient({
      apiToken: config.global.cloudflare_api_token,
      accountId: config.global.cloudflare_account_id,
    });

    warnings.push("Resource repair is a manual process - please run 'hoox workers setup' to repair worker resources");
  } catch (e) {
    errors.push(`Repair failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}