import type {
  WorkerHealth,
  CloudflareAdapter as ICloudflareAdapter,
} from "../core/types.js";

export class CloudflareAdapter implements ICloudflareAdapter {
  /**
   * Helper to run a wrangler command and return stdout text.
   * Throws on non-zero exit codes.
   */
  private async runWrangler(
    args: string[],
    errorMessage: string
  ): Promise<string> {
    const proc = Bun.spawn(["wrangler", ...args], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    const stdout = await new Response(proc.stdout).text();

    if (exitCode !== 0) {
      throw new Error(`${errorMessage}: ${stderr || stdout}`);
    }

    return stdout;
  }

  // Worker deployment methods
  async deployWorker(workerName: string): Promise<void> {
    const workerPath = `workers/${workerName}`;
    await this.runWrangler(
      ["deploy", "--config", `${workerPath}/wrangler.jsonc`],
      "Deploy failed"
    );
  }

  async testConnection(): Promise<boolean> {
    const proc = Bun.spawn(["wrangler", "whoami"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  }

  async getWorkerHealth(workerName: string): Promise<WorkerHealth> {
    // Simple health check - verify worker exists by checking wrangler config
    const configPath = `workers/${workerName}/wrangler.jsonc`;
    const exists = await Bun.file(configPath).exists();

    return {
      name: workerName,
      status: exists ? "healthy" : "down",
    };
  }

  // D1 Database methods (using wrangler CLI)
  async listD1Databases(): Promise<
    Array<{ uuid: string; name: string; title: string }>
  > {
    const stdout = await this.runWrangler(
      ["d1", "list", "--json"],
      "Failed to list D1 databases"
    );
    return JSON.parse(stdout || "[]");
  }

  async createD1Database(
    name: string
  ): Promise<{ uuid: string; name: string; title: string }> {
    const stdout = await this.runWrangler(
      ["d1", "create", name, "--json"],
      `Failed to create D1 database: ${name}`
    );
    return JSON.parse(stdout);
  }

  async deleteD1Database(uuid: string): Promise<void> {
    await this.runWrangler(
      ["d1", "delete", uuid, "--yes"],
      `Failed to delete D1 database: ${uuid}`
    );
  }

  async executeD1Query(
    databaseName: string,
    sql: string
  ): Promise<{ results: Record<string, unknown>[] }> {
    const stdout = await this.runWrangler(
      ["d1", "execute", databaseName, "--command", sql, "--json"],
      `Failed to execute D1 query on ${databaseName}`
    );
    const parsed = JSON.parse(stdout || "{}");
    return { results: parsed?.results || [] };
  }

  // KV Namespace methods
  async listKVNamespaces(): Promise<Array<{ id: string; title: string }>> {
    const stdout = await this.runWrangler(
      ["kv", "namespace", "list", "--json"],
      "Failed to list KV namespaces"
    );
    return JSON.parse(stdout || "[]");
  }

  async createKVNamespace(
    title: string
  ): Promise<{ id: string; title: string }> {
    const stdout = await this.runWrangler(
      ["kv", "namespace", "create", title, "--json"],
      `Failed to create KV namespace: ${title}`
    );
    return JSON.parse(stdout);
  }

  async deleteKVNamespace(id: string): Promise<void> {
    await this.runWrangler(
      ["kv", "namespace", "delete", id, "--yes"],
      `Failed to delete KV namespace: ${id}`
    );
  }

  async getKVValue(namespaceId: string, key: string): Promise<string | null> {
    try {
      const stdout = await this.runWrangler(
        ["kv", "key", "get", key, "--namespace-id", namespaceId],
        `Failed to get KV value for key: ${key}`
      );
      return stdout || null;
    } catch {
      return null;
    }
  }

  async putKVValue(
    namespaceId: string,
    key: string,
    value: string
  ): Promise<void> {
    await this.runWrangler(
      ["kv", "key", "put", key, value, "--namespace-id", namespaceId],
      `Failed to put KV value for key: ${key}`
    );
  }

  // R2 Bucket methods
  async listR2Buckets(): Promise<Array<{ name: string }>> {
    const stdout = await this.runWrangler(
      ["r2", "bucket", "list", "--json"],
      "Failed to list R2 buckets"
    );
    return JSON.parse(stdout || "[]");
  }

  async createR2Bucket(name: string): Promise<{ name: string }> {
    const stdout = await this.runWrangler(
      ["r2", "bucket", "create", name, "--json"],
      `Failed to create R2 bucket: ${name}`
    );
    return JSON.parse(stdout);
  }

  async deleteR2Bucket(name: string): Promise<void> {
    await this.runWrangler(
      ["r2", "bucket", "delete", name, "--yes"],
      `Failed to delete R2 bucket: ${name}`
    );
  }

  // Queues methods
  async listQueues(): Promise<Array<{ queue_name: string }>> {
    const stdout = await this.runWrangler(
      ["queues", "list", "--json"],
      "Failed to list queues"
    );
    return JSON.parse(stdout || "[]");
  }

  async createQueue(name: string): Promise<{ queue_name: string }> {
    const stdout = await this.runWrangler(
      ["queues", "create", name, "--json"],
      `Failed to create queue: ${name}`
    );
    return JSON.parse(stdout);
  }

  async deleteQueue(name: string): Promise<void> {
    await this.runWrangler(
      ["queues", "delete", name, "--yes"],
      `Failed to delete queue: ${name}`
    );
  }

  // Secrets methods
  async listSecrets(workerName: string): Promise<
    Array<{
      name: string;
      created: string;
      version: number;
      expires_on?: string;
    }>
  > {
    const stdout = await this.runWrangler(
      [
        "secret",
        "list",
        "--config",
        `workers/${workerName}/wrangler.jsonc`,
        "--json",
      ],
      `Failed to list secrets for: ${workerName}`
    );
    return JSON.parse(stdout || "[]");
  }

  async getSecret(
    _storeId: string,
    _name: string
  ): Promise<{
    name: string;
    created: string;
    version: number;
    expires_on?: string;
  }> {
    // Wrangler doesn't support getting individual secret values (security)
    throw new Error(
      "Getting individual secret values is not supported by Wrangler CLI"
    );
  }

  async setSecret(
    workerName: string,
    name: string,
    value: string
  ): Promise<void> {
    // Pass secret via stdin to avoid exposing it in process listings (ps, top, shell history)
    const proc = Bun.spawn(
      [
        "wrangler",
        "secret",
        "put",
        name,
        "--config",
        `workers/${workerName}/wrangler.jsonc`,
      ],
      {
        stdin: "pipe",
        stderr: "pipe",
        stdout: "pipe",
      }
    );

    await proc.stdin.write(value + "\n");
    proc.stdin.end();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to set secret: ${name}`);
    }
  }

  async deleteSecret(workerName: string, name: string): Promise<void> {
    await this.runWrangler(
      [
        "secret",
        "delete",
        name,
        "--config",
        `workers/${workerName}/wrangler.jsonc`,
        "--yes",
      ],
      `Failed to delete secret: ${name}`
    );
  }

  // Zones methods (using Cloudflare API directly)
  async listZones(): Promise<
    Array<{ id: string; name: string; status: string }>
  > {
    // This would require Cloudflare API token - for now return empty
    // In production, use: curl -X GET "https://api.cloudflare.com/client/v4/zones"
    return [];
  }

  async listDNSRecords(
    _zoneId: string
  ): Promise<
    Array<{ id: string; type: string; name: string; content: string }>
  > {
    // This would require Cloudflare API token
    return [];
  }

  async addDNSRecord(
    _zoneId: string,
    _record: { type: string; name: string; content: string; priority?: number }
  ): Promise<{ id: string }> {
    // This would require Cloudflare API token
    throw new Error(
      "DNS record management requires Cloudflare API integration"
    );
  }

  async deleteDNSRecord(_zoneId: string, _recordId: string): Promise<void> {
    // This would require Cloudflare API token
    throw new Error(
      "DNS record management requires Cloudflare API integration"
    );
  }
}
