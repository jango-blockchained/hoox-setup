import type { WorkerHealth, CloudflareAdapter as ICloudflareAdapter } from "../core/types.js";

export class CloudflareAdapter implements ICloudflareAdapter {
  // Worker deployment methods
  async deployWorker(workerName: string): Promise<void> {
    const workerPath = `workers/${workerName}`;

    const proc = Bun.spawn(["wrangler", "deploy", "--config", `${workerPath}/wrangler.jsonc`], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    const stdout = await new Response(proc.stdout).text();

    if (exitCode !== 0) {
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
  async listD1Databases(): Promise<Array<{ uuid: string; name: string; title: string }>> {
    const proc = Bun.spawn(["wrangler", "d1", "list", "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error("Failed to list D1 databases");
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout || "[]");
  }

  async createD1Database(name: string): Promise<{ uuid: string; name: string; title: string }> {
    const proc = Bun.spawn(["wrangler", "d1", "create", name, "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to create D1 database: ${name}`);
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout);
  }

  async deleteD1Database(uuid: string): Promise<void> {
    const proc = Bun.spawn(["wrangler", "d1", "delete", uuid, "--yes"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to delete D1 database: ${uuid}`);
    }
  }

  // KV Namespace methods
  async listKVNamespaces(): Promise<Array<{ id: string; title: string }>> {
    const proc = Bun.spawn(["wrangler", "kv", "namespace", "list", "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error("Failed to list KV namespaces");
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout || "[]");
  }

  async createKVNamespace(title: string): Promise<{ id: string; title: string }> {
    const proc = Bun.spawn(["wrangler", "kv", "namespace", "create", title, "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to create KV namespace: ${title}`);
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout);
  }

  async deleteKVNamespace(id: string): Promise<void> {
    const proc = Bun.spawn(["wrangler", "kv", "namespace", "delete", id, "--yes"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to delete KV namespace: ${id}`);
    }
  }

  // R2 Bucket methods
  async listR2Buckets(): Promise<Array<{ name: string }>> {
    const proc = Bun.spawn(["wrangler", "r2", "bucket", "list", "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error("Failed to list R2 buckets");
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout || "[]");
  }

  async createR2Bucket(name: string): Promise<{ name: string }> {
    const proc = Bun.spawn(["wrangler", "r2", "bucket", "create", name, "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to create R2 bucket: ${name}`);
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout);
  }

  async deleteR2Bucket(name: string): Promise<void> {
    const proc = Bun.spawn(["wrangler", "r2", "bucket", "delete", name, "--yes"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to delete R2 bucket: ${name}`);
    }
  }

  // Queues methods
  async listQueues(): Promise<Array<{ queue_name: string }>> {
    const proc = Bun.spawn(["wrangler", "queues", "list", "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error("Failed to list queues");
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout || "[]");
  }

  async createQueue(name: string): Promise<{ queue_name: string }> {
    const proc = Bun.spawn(["wrangler", "queues", "create", name, "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to create queue: ${name}`);
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout);
  }

  async deleteQueue(name: string): Promise<void> {
    const proc = Bun.spawn(["wrangler", "queues", "delete", name, "--yes"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to delete queue: ${name}`);
    }
  }

  // Secrets methods
  async listSecrets(workerName: string): Promise<Array<{ name: string; created: string; version: number; expires_on?: string }>> {
    const proc = Bun.spawn(["wrangler", "secret", "list", "--config", `workers/${workerName}/wrangler.jsonc`, "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to list secrets for: ${workerName}`);
    }

    const stdout = await new Response(proc.stdout).text();
    return JSON.parse(stdout || "[]");
  }

  async getSecret(_storeId: string, _name: string): Promise<{ name: string; created: string; version: number; expires_on?: string }> {
    // Wrangler doesn't support getting individual secret values (security)
    throw new Error("Getting individual secret values is not supported by Wrangler CLI");
  }

  async setSecret(workerName: string, name: string, value: string): Promise<void> {
    const proc = Bun.spawn(["wrangler", "secret", "put", name, value, "--config", `workers/${workerName}/wrangler.jsonc`], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to set secret: ${name}`);
    }
  }

  async deleteSecret(workerName: string, name: string): Promise<void> {
    const proc = Bun.spawn(["wrangler", "secret", "delete", name, "--config", `workers/${workerName}/wrangler.jsonc`, "--yes"], {
      stderr: "pipe",
      stdout: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to delete secret: ${name}`);
    }
  }

  // Zones methods (using Cloudflare API directly)
  async listZones(): Promise<Array<{ id: string; name: string; status: string }>> {
    // This would require Cloudflare API token - for now return empty
    // In production, use: curl -X GET "https://api.cloudflare.com/client/v4/zones"
    return [];
  }

  async listDNSRecords(_zoneId: string): Promise<Array<{ id: string; type: string; name: string; content: string }>> {
    // This would require Cloudflare API token
    return [];
  }

  async addDNSRecord(_zoneId: string, _record: { type: string; name: string; content: string; priority?: number }): Promise<{ id: string }> {
    // This would require Cloudflare API token
    throw new Error("DNS record management requires Cloudflare API integration");
  }

  async deleteDNSRecord(_zoneId: string, _recordId: string): Promise<void> {
    // This would require Cloudflare API token
    throw new Error("DNS record management requires Cloudflare API integration");
  }
}
