import { exec } from "child_process";
import { promisify } from "util";
import type { WorkerHealth } from "../core/types.js";

const execAsync = promisify(exec);

export class CloudflareAdapter {
  async deployWorker(workerName: string): Promise<void> {
    const workerPath = `workers/${workerName}`;
    const { stdout, stderr } = await execAsync(`wrangler deploy ${workerPath}/src/index.ts`);
    
    if (stderr && !stderr.includes("Warning")) {
      throw new Error(`Deploy failed: ${stderr}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await execAsync("wrangler whoami");
      return true;
    } catch {
      return false;
    }
  }

  async getWorkerMetrics(workerName: string): Promise<WorkerHealth> {
    return {
      name: workerName,
      status: "healthy",
    };
  }
}
