// Source: workers/hoox/src/logic.ts (lines 119-223)
// Listing id: process-trade
// Caption: Trade routing: idempotency, queue mode, Service Binding forward
export async function processTrade(
  tradeData: TradeData,
  env: TradeEnv,
  logger: Logger,
  options: {
    checkIdempotency: (
      env: IdempotencyEnv,
      key: string,
      logger: Logger
    ) => Promise<boolean>;
    sendTradeToQueue: (
      queue: Queue,
      data: TradeData,
      logger: Logger
    ) => Promise<void>;
    MAX_TRADES_PER_MINUTE: number;
  },
  queueMode:
    | "queue_everywhere"
    | "queue_failover"
    | "queue_disabled" = "queue_failover"
): Promise<ServiceResponse> {
  const { requestId } = tradeData;
  const { checkIdempotency, sendTradeToQueue } = options;

  // Check idempotency before processing (skip for probe mode)
  if (tradeData.probe !== true) {
    const idempotencyKey = generateIdempotencyKey(tradeData);
    const isNew = await checkIdempotency(env, idempotencyKey, logger);
    if (!isNew) {
      logger.info(
        `[${requestId}] Duplicate trade detected, rejecting: ${idempotencyKey}`
      );
      return {
        success: false,
        requestId,
        error: "Duplicate trade request. This trade was already processed.",
      };
    }
  }

  // Check if we should use queue (queue_disabled skips queue entirely)
  const useQueue =
    queueMode !== "queue_disabled" &&
    (queueMode === "queue_everywhere" || !env.TRADE_SERVICE);

  if (useQueue && env.TRADE_QUEUE) {
    try {
      await sendTradeToQueue(env.TRADE_QUEUE, tradeData, logger);
      return {
        success: true,
        requestId,
        tradeResult: { queued: true, message: "Trade queued for execution" },
      };
    } catch (error: unknown) {
      logger.error(`[${requestId}] Failed to queue trade:`, {
        error: toError(error),
      });
    }
  }

  // Direct service call
  if (!env.TRADE_SERVICE) {
    logger.error(`[${requestId}] TRADE_SERVICE binding is not configured.`);
    return {
      success: false,
      requestId,
      error: "TRADE_SERVICE binding is not configured.",
    };
  }

  try {
    const internalKey = env.INTERNAL_KEY_BINDING;
    if (!internalKey) {
      logger.error(`[${requestId}] INTERNAL_KEY_BINDING not configured.`);
      return {
        success: false,
        requestId,
        error: "Internal authentication key not configured.",
      };
    }
    const res = await serviceFetch(env.TRADE_SERVICE, "/webhook", tradeData, {
      headers: {
        "X-Internal-Auth-Key": internalKey,
        "X-Request-ID": requestId,
      },
    });
    const result = await res.json();
    return {
      success: res.ok,
      requestId,
      tradeResult: result,
      error: res.ok ? undefined : "Trade worker returned error",
    };
  } catch (error: unknown) {
    logger.error(`[${requestId}] Error calling TRADE_SERVICE:`, {
      error: toError(error),
    });
    return {
      success: false,
      requestId,
      error: `Error calling trade service: ${toError(error)}`,
    };
  }
}
