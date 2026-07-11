// Source: workers/hoox/src/logic.ts (lines 64-92)
// Listing id: idempotency-key
// Caption: Idempotency key generation and fail-open check
/**
 * Generate idempotency key for a trade
 */
export function generateIdempotencyKey(tradeData: TradeData): string {
  return `trade:${tradeData.exchange}:${tradeData.symbol}:${tradeData.action}:${tradeData.quantity}`;
}

/**
 * Check and store idempotency key using Durable Object
 */
export async function checkIdempotency(
  env: IdempotencyEnv,
  key: string,
  logger: Logger
): Promise<boolean> {
  if (!env.IDEMPOTENCY_STORE) {
    return true; // No DO configured, allow all
  }

  try {
    const id = env.IDEMPOTENCY_STORE.idFromName(key);
    // DurableObjectStub is an RPC proxy -- cast to the DO class interface
    const stub = env.IDEMPOTENCY_STORE.get(id) as unknown as IdempotencyStore;
    return await stub.checkAndStore(key);
  } catch (error) {
    logger.error("[checkIdempotency] Error:", { error: toError(error) });
    return true; // Allow on error to not block trades
  }
}
