export class WorkersAdapter {
  async callServiceBinding(
    worker: string,
    method: string,
    data?: unknown
  ): Promise<unknown> {
    const stdinData = data ? JSON.stringify(data) : undefined;
    
    const proc = Bun.spawn(["wrangler", "dispatch", worker, method], {
      stdin: stdinData ? Buffer.from(stdinData) : undefined,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      throw new Error(`Service binding call failed: ${stderr || stdout}`);
    }

    try {
      return JSON.parse(stdout);
    } catch {
      return { success: true, output: stdout };
    }
  }
}
