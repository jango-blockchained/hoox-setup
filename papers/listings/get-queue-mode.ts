// Source: workers/hoox/src/logic.ts (lines 43-62)
// Listing id: get-queue-mode
// Caption: KV-backed queue mode resolution with 60s cache
export async function getQueueMode(
  kv: KVNamespace
): Promise<"queue_everywhere" | "queue_failover" | "queue_disabled"> {
  const now = Date.now();
  if (cachedQueueMode && now < queueModeCacheExpiry) {
    return cachedQueueMode;
  }

  const mode = await kv.get(KVKeys.KV_WEBHOOK_QUEUE_MODE);
  const resolved =
    mode === "queue_disabled"
      ? "queue_disabled"
      : mode === "queue_everywhere"
        ? "queue_everywhere"
        : "queue_failover";

  cachedQueueMode = resolved;
  queueModeCacheExpiry = now + QUEUE_MODE_CACHE_TTL_MS;
  return resolved;
}
