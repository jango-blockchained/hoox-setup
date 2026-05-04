import type { WorkerHealth } from "../core/types.js";

export class CloudflareAdapter {
  async deployWorker(workerName: string): Promise<void> {
    const workerPath = `workers/${workerName}`;
    
    const proc = Bun.spawn(["wrangler", "deploy", `${workerPath}/src/index.ts`], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    const stdout = await new Response(proc.stdout).text();

    if (exitCode !== 0 && !stderr.includes("Warning")) {
      throw new Error(`Deploy failed: ${stderr || stdout}`);
    }
  }

  async testConnection(): Promise<boolean> {
    const proc = Bun.spawn(["wrangler", "whoami"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  }

  async getWorkerMetrics(workerName: string): Promise<WorkerHealth> {
    return {
      name: workerName,
      status: "healthy",
    };
  }
}
