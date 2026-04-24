/**
 * Shared TypeScript types for Worker wrangler configurations.
 * Use these for runtime config parsing and validation.
 */

export interface WranglerConfig {
  name: string;
  account_id?: string;
  main?: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
  observability?: ObservabilityConfig;
  vars?: Record<string, string | null>;
  services?: ServiceBinding[];
  kv_namespaces?: KVNamespaceBinding[];
  d1_databases?: D1DatabaseBinding[];
  r2_buckets?: R2BucketBinding[];
  queues?: QueuesConfig;
  durable_objects?: DurableObjectsConfig;
  vectorize?: VectorizeBinding[];
  ai?: AIBinding;
  browser?: BrowserBinding;
  triggers?: TriggersConfig;
}

export interface ObservabilityConfig {
  enabled: boolean;
  head_sampling_rate?: number;
}

export interface ServiceBinding {
  binding: string;
  service: string;
}

export interface KVNamespaceBinding {
  binding: string;
  id: string;
  preview_id?: string;
}

export interface D1DatabaseBinding {
  binding: string;
  database_name: string;
  database_id: string;
  preview_database_id?: string;
}

export interface R2BucketBinding {
  binding: string;
  bucket_name: string;
  preview_bucket_name?: string;
}

export interface QueuesConfig {
  producers?: QueueBinding[];
  consumers?: QueueConsumerBinding[];
}

export interface QueueBinding {
  binding: string;
  queue: string;
}

export interface QueueConsumerBinding {
  queue: string;
}

export interface DurableObjectsConfig {
  bindings?: DOBinding[];
  migrations?: DOMigration[];
}

export interface DOBinding {
  name: string;
  class_name: string;
}

export interface DOMigration {
  tag: string;
  new_sqlite_classes?: string[];
}

export interface VectorizeBinding {
  binding: string;
  index_name: string;
}

export interface AIBinding {
  binding: string;
}

export interface BrowserBinding {
  binding: string;
}

export interface TriggersConfig {
  crons?: string[];
}

/**
 * Parse a wrangler.jsonc file content
 */
export function parseWranglerJsonc(content: string): WranglerConfig {
  const jsonContent = content
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return JSON.parse(jsonContent) as WranglerConfig;
}

/**
 * Validate required fields
 */
export function validateWranglerConfig(config: WranglerConfig): string[] {
  const errors: string[] = [];
  
  if (!config.name) errors.push("Missing required field: name");
  if (!config.main) errors.push("Missing required field: main");
  if (!config.compatibility_date) errors.push("Missing recommended field: compatibility_date");
  
  return errors;
}