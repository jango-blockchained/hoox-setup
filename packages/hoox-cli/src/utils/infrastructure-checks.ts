import type { CloudflareAdapter } from "../core/types.js";
import { createValidationResult, type ValidationResult } from "./validation.js";

export async function checkD1Database(
  adapter: CloudflareAdapter,
  expectedName: string
): Promise<ValidationResult> {
  const result = createValidationResult("D1 Database");
  try {
    const databases = await adapter.listD1Databases();
    const found = databases.find((db) => db.name === expectedName);
    if (!found) {
      result.addError(
        `D1 database "${expectedName}" not found. Create it with: wrangler d1 create ${expectedName}`
      );
    }
  } catch (err) {
    result.addError(`Failed to list D1 databases: ${err}`);
  }
  return result;
}

export async function checkKVNamespaces(
  adapter: CloudflareAdapter,
  expectedNamespaces: { binding: string; id: string }[]
): Promise<ValidationResult> {
  const result = createValidationResult("KV Namespaces");
  try {
    const namespaces = await adapter.listKVNamespaces();
    for (const expected of expectedNamespaces) {
      const found = namespaces.find((ns) => ns.id === expected.id);
      if (!found) {
        result.addError(
          `KV namespace "${expected.binding}" (id: ${expected.id}) not found. Create it with: wrangler kv:namespace create ${expected.binding}`
        );
      }
    }
  } catch (err) {
    result.addError(`Failed to list KV namespaces: ${err}`);
  }
  return result;
}

export async function checkR2Buckets(
  adapter: CloudflareAdapter,
  expectedBuckets: string[]
): Promise<ValidationResult> {
  const result = createValidationResult("R2 Buckets");
  try {
    const buckets = await adapter.listR2Buckets();
    for (const expected of expectedBuckets) {
      const found = buckets.find((b) => b.name === expected);
      if (!found) {
        result.addError(
          `R2 bucket "${expected}" not found. Create it with: wrangler r2 bucket create ${expected}`
        );
      }
    }
  } catch (err) {
    result.addError(`Failed to list R2 buckets: ${err}`);
  }
  return result;
}

export async function checkQueues(
  adapter: CloudflareAdapter,
  expectedQueues: string[]
): Promise<ValidationResult> {
  const result = createValidationResult("Queues");
  try {
    const queues = await adapter.listQueues();
    for (const expected of expectedQueues) {
      const found = queues.find((q) => q.queue_name === expected);
      if (!found) {
        result.addError(
          `Queue "${expected}" not found. Create it with: wrangler queues create ${expected}`
        );
      }
    }
  } catch (err) {
    result.addError(`Failed to list queues: ${err}`);
  }
  return result;
}

export async function checkVectorizeIndex(
  adapter: CloudflareAdapter,
  expectedIndex: string
): Promise<ValidationResult> {
  const result = createValidationResult("Vectorize Index");
  try {
    // Vectorize indexes are checked via wrangler CLI, not directly via adapter
    // We'll use a best-effort approach
    result.addWarning(
      `Vectorize index "${expectedIndex}" must be verified manually. Create with: wrangler vectorize create ${expectedIndex} --dimensions=768 --metric=cosine`
    );
  } catch (err) {
    result.addWarning(`Could not verify Vectorize index: ${err}`);
  }
  return result;
}

export async function checkAnalyticsEngine(
  expectedDataset: string
): Promise<ValidationResult> {
  const result = createValidationResult("Analytics Engine");
  result.addWarning(
    `Analytics Engine dataset "${expectedDataset}" must be verified manually in Cloudflare Dashboard`
  );
  return result;
}
