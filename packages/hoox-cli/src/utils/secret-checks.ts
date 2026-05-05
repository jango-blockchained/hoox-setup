import type { CloudflareAdapter } from "../core/types.js";
import { createValidationResult, type ValidationResult } from "./validation.js";

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
      const secretNames = secrets.map((s: any) => s.name);

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
    const hasKey = content.includes(`${secret}=`);
    const hasPlaceholder = content.includes(`${secret}="your_`) || content.includes(`${secret}="generate_`);
    if (!hasKey) {
      result.addError(`${secret} is missing in .env.local`);
    } else if (hasPlaceholder) {
      result.addWarning(`${secret} has a placeholder value in .env.local`);
    }
  }

  return result;
}

export async function checkDevVars(
  cwd: string,
  workers: Record<string, { enabled: boolean; path: string }>
): Promise<ValidationResult> {
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