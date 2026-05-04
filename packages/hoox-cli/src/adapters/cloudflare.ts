import type { WorkerHealth } from "../core/types.js";
import { CloudflareClient } from "../lib/cf-client.js";
import { loadConfig } from "../configUtils.js";

export class CloudflareAdapter {
  private client: CloudflareClient | null = null;

  private async getClient(): Promise<CloudflareClient> {
    if (!this.client) {
      const config = await loadConfig();
      this.client = new CloudflareClient({
        apiToken: config.global.cloudflare_api_token,
        accountId: config.global.cloudflare_account_id,
      });
    }
    return this.client;
  }

  // Worker deployment methods
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

  // D1 Database methods
  async listD1Databases(): Promise<Array<{ uuid: string; name: string; title: string }>> {
    const client = await this.getClient();
    return client.listD1Databases();
  }

  async createD1Database(name: string): Promise<{ uuid: string; name: string; title: string }> {
    const client = await this.getClient();
    return client.createD1Database(name);
  }

  async deleteD1Database(uuid: string): Promise<void> {
    const client = await this.getClient();
    return client.deleteD1Database(uuid);
  }

  // KV Namespace methods
  async listKVNamespaces(): Promise<Array<{ id: string; title: string }>> {
    const client = await this.getClient();
    return client.listKVNamespaces();
  }

  async createKVNamespace(title: string): Promise<{ id: string; title: string }> {
    const client = await this.getClient();
    return client.createKVNamespace(title);
  }

  async deleteKVNamespace(id: string): Promise<void> {
    const client = await this.getClient();
    return client.deleteKVNamespace(id);
  }

  // R2 Bucket methods
  async listR2Buckets(): Promise<Array<{ name: string }>> {
    const client = await this.getClient();
    return client.listR2Buckets();
  }

  async createR2Bucket(name: string): Promise<{ name: string }> {
    const client = await this.getClient();
    return client.createR2Bucket(name);
  }

  async deleteR2Bucket(name: string): Promise<void> {
    const client = await this.getClient();
    return client.deleteR2Bucket(name);
  }

  // Queues methods
  async listQueues(): Promise<Array<{ queue_name: string }>> {
    const client = await this.getClient();
    return client.listQueues();
  }

  async createQueue(name: string): Promise<{ queue_name: string }> {
    const client = await this.getClient();
    return client.createQueue(name);
  }

  async deleteQueue(name: string): Promise<void> {
    const client = await this.getClient();
    return client.deleteQueue(name);
  }

  // Zones methods
  async listZones(): Promise<Array<{ id: string; name: string; status: string }>> {
    const client = await this.getClient();
    return client.listZones();
  }

  async listDNSRecords(
    zoneId: string
  ): Promise<Array<{ id: string; type: string; name: string; content: string }>> {
    const client = await this.getClient();
    return client.listDNSRecords(zoneId);
  }

  async addDNSRecord(
    zoneId: string,
    record: { type: string; name: string; content: string; priority?: number }
  ): Promise<{ id: string }> {
    const client = await this.getClient();
    return client.addDNSRecord(zoneId, record);
  }

  async deleteDNSRecord(zoneId: string, recordId: string): Promise<void> {
    const client = await this.getClient();
    return client.deleteDNSRecord(zoneId, recordId);
  }

  // Secrets methods
  async listSecrets(storeId: string): Promise<Array<{ name: string; created: string; version: number; expires_on?: string }>> {
    const client = await this.getClient();
    return client.listSecrets(storeId);
  }

  async getSecret(storeId: string, name: string): Promise<{ name: string; created: string; version: number; expires_on?: string }> {
    const client = await this.getClient();
    return client.getSecret(storeId, name);
  }

  async setSecret(storeId: string, name: string, value: string): Promise<void> {
    const client = await this.getClient();
    return client.setSecret(storeId, name, value);
  }

  async deleteSecret(storeId: string, name: string): Promise<void> {
    const client = await this.getClient();
    return client.deleteSecret(storeId, name);
  }
}
