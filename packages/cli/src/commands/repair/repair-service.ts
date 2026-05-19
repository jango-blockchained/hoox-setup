import { CloudflareService } from "../../services/cloudflare/index.js";
import { SecretsService } from "../../services/secrets/index.js";
import type { RepairStepResult, RepairCheckResult } from "./types.js";

export class RepairService {
  async runSystemCheck(): Promise<RepairCheckResult> {
    const steps: RepairStepResult[] = [];

    // Step 1: Repository integrity (worker submodules)
    try {
      const proc = Bun.spawn(["bun", "run", "check:worker-submodules"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exit = await proc.exited;
      steps.push({
        step: "Worker submodules",
        success: exit === 0,
        message: exit === 0 ? "All submodules present" : "Missing submodules",
      });
    } catch (err) {
      steps.push({
        step: "Worker submodules",
        success: false,
        error: String(err),
      });
    }

    // Step 2: Dependencies
    try {
      const proc = Bun.spawn(["bun", "install"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exit = await proc.exited;
      steps.push({
        step: "Dependencies",
        success: exit === 0,
        message:
          exit === 0 ? "All dependencies installed" : "bun install failed",
      });
    } catch (err) {
      steps.push({ step: "Dependencies", success: false, error: String(err) });
    }

    // Step 3: TypeScript
    try {
      const proc = Bun.spawn(["bun", "run", "typecheck"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exit = await proc.exited;
      steps.push({
        step: "TypeScript",
        success: exit === 0,
        message: exit === 0 ? "No type errors" : "TypeScript errors found",
      });
    } catch (err) {
      steps.push({ step: "TypeScript", success: false, error: String(err) });
    }

    // Step 4: Infrastructure
    try {
      const cf = new CloudflareService();
      const d1Result = await cf.d1List();
      const kvResult = await cf.kvList();
      const r2Result = await cf.r2List();
      const queueResult = await cf.queueList();

      let infraOk = true;
      const details: string[] = [];
      if (d1Result.ok) details.push("D1: ✓");
      else {
        infraOk = false;
        details.push("D1: ✗");
      }
      if (kvResult.ok) details.push("KV: ✓");
      else {
        infraOk = false;
        details.push("KV: ✗");
      }
      if (r2Result.ok) details.push("R2: ✓");
      else {
        infraOk = false;
        details.push("R2: ✗");
      }
      if (queueResult.ok) details.push("Queues: ✓");
      else {
        infraOk = false;
        details.push("Queues: ✗");
      }

      steps.push({
        step: "Infrastructure",
        success: infraOk,
        message: details.join(", "),
      });
    } catch (err) {
      steps.push({
        step: "Infrastructure",
        success: false,
        error: String(err),
      });
    }

    // Step 5: Secrets
    try {
      const secrets = await SecretsService.create();
      const allSecrets = secrets.listAllSecrets();
      let missingCount = 0;
      let totalSecrets = 0;
      for (const workerName of Object.keys(allSecrets)) {
        const check = await secrets.checkLocalSecrets(workerName);
        totalSecrets += check.secrets.length;
        missingCount += check.missing.length;
      }
      steps.push({
        step: "Secrets",
        success: missingCount === 0,
        message:
          missingCount === 0
            ? `All ${totalSecrets} secrets present`
            : `${missingCount}/${totalSecrets} missing`,
      });
    } catch (err) {
      steps.push({ step: "Secrets", success: false, error: String(err) });
    }

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

    const passed = steps.filter((s) => s.success).length;
    const failed = steps.filter((s) => !s.success).length;
    return {
      steps,
      allPassed: failed === 0,
      passedCount: passed,
      failedCount: failed,
    };
  }
}
