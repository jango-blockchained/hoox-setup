import { readFileSync } from "fs";
import { resolve } from "path";
import {
  WORKER_MANIFESTS,
  WORKER_NAMES,
  validateWranglerJsonc,
  validateRootSecrets,
  validateDevVars,
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
