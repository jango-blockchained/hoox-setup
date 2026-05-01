import { z } from "zod";

export interface CFConfig {
  apiToken: string;
  accountId: string;
}

export interface D1Database {
  uuid: string;
  name: string;
  title: string;
  created_at: string;
  version: number;
}

export interface R2Bucket {
  name: string;
  creation_date: string;
}

export interface KVNamespace {
  id: string;
  title: string;
  supports_url_encoding: boolean;
}

export interface Queue {
  queue_name: string;
  production_queue_id: string | null;
  dead_letter_queue: string | null;
}

export interface Secret {
  name: string;
  created: string;
  version: number;
  expires_on: string | null;
}

export interface Worker {
  id: string;
  script_name: string;
  created_on: string;
  modified_on: string;
  mvps_all_starts_at: string | null;
}

export interface WorkerVersion {
  version: string;
  deployed_on: string;
}

export interface Analytics {
  requests: { total: number; cached: number; uncached: number };
  dataTransfer: { uploaded: number; downloaded: number };
  responseTime: number;
  errors: number;
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export class CloudflareClient {
  private baseUrl = "https://api.cloudflare.com/client/v4";
  private apiToken: string;
  private accountId: string;

  constructor(config: CFConfig) {
    this.apiToken = config.apiToken;
    this.accountId = config.accountId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CF API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private checkSuccess(result: any): void {
    if (!result.success && result.errors) {
      throw new Error(result.errors.map((e: any) => e.message).join(", "));
    }
  }

  async listD1Databases(): Promise<D1Database[]> {
    const result = await this.request<{ result: D1Database[] }>(
      `/accounts/${this.accountId}/d1/databases`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async createD1Database(name: string): Promise<D1Database> {
    const result = await this.request<{ result: D1Database }>(
      `/accounts/${this.accountId}/d1/databases`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      }
    );
    this.checkSuccess(result);
    return result.result;
  }

  async getD1Database(id: string): Promise<D1Database> {
    const result = await this.request<{ result: D1Database }>(
      `/accounts/${this.accountId}/d1/databases/${id}`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async deleteD1Database(id: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/d1/databases/${id}`,
      { method: "DELETE" }
    );
    this.checkSuccess(result);
  }

  async executeD1Query(dbId: string, query: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/d1/databases/${dbId}/query`,
      {
        method: "POST",
        body: JSON.stringify({ sql: query }),
      }
    );
    this.checkSuccess(result);
  }

  async listR2Buckets(): Promise<R2Bucket[]> {
    const result = await this.request<{ result: R2Bucket[] }>(
      `/accounts/${this.accountId}/r2/buckets`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async createR2Bucket(name: string): Promise<R2Bucket> {
    const result = await this.request<{ result: R2Bucket }>(
      `/accounts/${this.accountId}/r2/buckets`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      }
    );
    this.checkSuccess(result);
    return result.result;
  }

  async deleteR2Bucket(name: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/r2/buckets/${name}`,
      { method: "DELETE" }
    );
    this.checkSuccess(result);
  }

  async listKVNamespaces(): Promise<KVNamespace[]> {
    const result = await this.request<{ result: KVNamespace[] }>(
      `/accounts/${this.accountId}/storage/kv/namespaces`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async createKVNamespace(title: string): Promise<KVNamespace> {
    const result = await this.request<{ result: KVNamespace }>(
      `/accounts/${this.accountId}/storage/kv/namespaces`,
      {
        method: "POST",
        body: JSON.stringify({ title }),
      }
    );
    this.checkSuccess(result);
    return result.result;
  }

  async deleteKVNamespace(id: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${id}`,
      { method: "DELETE" }
    );
    this.checkSuccess(result);
  }

  async getKVValue(nsId: string, key: string): Promise<string | null> {
    const encodedKey = encodeURIComponent(key);
    const result = await this.request<{ result: string | null }>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${nsId}/values/${encodedKey}`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async setKVValue(nsId: string, key: string, value: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${nsId}/values`,
      {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      }
    );
    this.checkSuccess(result);
  }

  async deleteKVKey(nsId: string, key: string): Promise<void> {
    const encodedKey = encodeURIComponent(key);
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${nsId}/values/${encodedKey}`,
      { method: "DELETE" }
    );
    this.checkSuccess(result);
  }

  async listQueues(): Promise<Queue[]> {
    const result = await this.request<{ result: Queue[] }>(
      `/accounts/${this.accountId}/queues`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async createQueue(name: string): Promise<Queue> {
    const result = await this.request<{ result: Queue }>(
      `/accounts/${this.accountId}/queues`,
      {
        method: "POST",
        body: JSON.stringify({ queue_name: name }),
      }
    );
    this.checkSuccess(result);
    return result.result;
  }

  async deleteQueue(name: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/queues/${name}`,
      { method: "DELETE" }
    );
    this.checkSuccess(result);
  }

  async listSecrets(storeId: string): Promise<Secret[]> {
    const result = await this.request<{ result: Secret[] }>(
      `/accounts/${this.accountId}/secrets_store/bindings/${storeId}/secrets`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async getSecret(storeId: string, name: string): Promise<Secret> {
    const result = await this.request<{ result: Secret }>(
      `/accounts/${this.accountId}/secrets_store/bindings/${storeId}/secrets/${name}`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async setSecret(storeId: string, name: string, value: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/secrets_store/bindings/${storeId}/secrets/${name}`,
      {
        method: "PUT",
        body: JSON.stringify({ plaintext: value }),
      }
    );
    this.checkSuccess(result);
  }

  async deleteSecret(storeId: string, name: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/secrets_store/bindings/${storeId}/secrets/${name}`,
      { method: "DELETE" }
    );
    this.checkSuccess(result);
  }

  async listWorkers(): Promise<Worker[]> {
    const result = await this.request<{ result: Worker[] }>(
      `/accounts/${this.accountId}/workers`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async getWorkerVersions(scriptName: string): Promise<WorkerVersion[]> {
    const result = await this.request<{ result: WorkerVersion[] }>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/versions`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async getWorker(scriptName: string): Promise<Worker> {
    const result = await this.request<{ result: Worker }>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async rollbackWorker(scriptName: string, version: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/rollback`,
      {
        method: "POST",
        body: JSON.stringify({ version }),
      }
    );
    this.checkSuccess(result);
  }

  async getWorkerAnalytics(scriptName: string): Promise<Analytics> {
    const result = await this.request<{ result: Analytics }>(
      `/accounts/${this.accountId}/workers/analytics?worker=${scriptName}`
    );
    this.checkSuccess(result);
    return result.result;
  }

  async listZones(): Promise<
    Array<{ id: string; name: string; status: string }>
  > {
    const result = await this.request<{
      result: Array<{ id: string; name: string; status: string }>;
    }>(`/zones`);
    this.checkSuccess(result);
    return result.result;
  }

  async listDNSRecords(
    zoneId: string
  ): Promise<
    Array<{ id: string; type: string; name: string; content: string }>
  > {
    const result = await this.request<{
      result: Array<{
        id: string;
        type: string;
        name: string;
        content: string;
      }>;
    }>(`/zones/${zoneId}/dns_records`);
    this.checkSuccess(result);
    return result.result;
  }

  async addDNSRecord(
    zoneId: string,
    record: { type: string; name: string; content: string; priority?: number }
  ): Promise<{ id: string }> {
    const result = await this.request<{ result: { id: string } }>(
      `/zones/${zoneId}/dns_records`,
      {
        method: "POST",
        body: JSON.stringify(record),
      }
    );
    this.checkSuccess(result);
    return result.result;
  }

  async deleteDNSRecord(zoneId: string, recordId: string): Promise<void> {
    const result = await this.request<{ success: boolean }>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      { method: "DELETE" }
    );
    this.checkSuccess(result);
  }
}

export async function createCFClient(
  config: CFConfig
): Promise<CloudflareClient> {
  return new CloudflareClient(config);
}

export function createValidationResult(
  success: boolean,
  errors: string[] = [],
  warnings: string[] = []
): ValidationResult {
  return { success, errors, warnings };
}
