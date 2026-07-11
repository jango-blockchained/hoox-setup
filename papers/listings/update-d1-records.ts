// Source: workers/trade-worker/src/execution.ts (lines 93-177)
// Listing id: update-d1-records
// Caption: Fire-and-forget D1 trade/position writes via waitUntil
export async function updateD1TradeRecords(
  env: ExecutionEnv,
  result: unknown,
  payload: WebhookPayload,
  routedExchange: string,
  overriddenLeverage: number | undefined,
  ctx?: ExecutionContext
): Promise<void> {
  if (!env.D1_SERVICE) return;

  try {
    const tradeId = crypto.randomUUID();
    const { action, symbol, quantity, price } = payload;
    const tradeStatus = "EXECUTED";

    const tradePayload = {
      query: `INSERT INTO trades (id, timestamp, exchange, symbol, action, quantity, price, leverage, status, raw_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        tradeId,
        Math.floor(Date.now() / 1000),
        routedExchange,
        symbol,
        action,
        quantity,
        price || null,
        overriddenLeverage || null,
        tradeStatus,
        JSON.stringify(result),
      ],
    };

    const side = action.includes("LONG") ? "LONG" : "SHORT";
    const posStatus = action.startsWith("CLOSE") ? "CLOSED" : "OPEN";
    const posId = `${routedExchange}-${symbol}-${side}`;

    const posPayload = {
      query: `REPLACE INTO positions (id, exchange, symbol, side, size, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        posId,
        routedExchange,
        symbol,
        side,
        posStatus === "OPEN" ? quantity : 0,
        posStatus,
        Math.floor(Date.now() / 1000),
      ],
    };

    // Fail closed: if INTERNAL_KEY_BINDING is not configured, don't send the request
    if (!env.INTERNAL_KEY_BINDING) {
      logger.error(
        "INTERNAL_KEY_BINDING not configured, cannot update D1 trade records"
      );
      return;
    }

    const d1Headers = { "X-Internal-Auth-Key": env.INTERNAL_KEY_BINDING };
    const tradeWrite = serviceFetch(env.D1_SERVICE, "/query", tradePayload, {
      headers: d1Headers,
    }).catch((err) => {
      logger.error("Background D1 trade-record write failed", {
        tradeId,
        error: toError(err),
      });
    });
    const posWrite = serviceFetch(env.D1_SERVICE, "/query", posPayload, {
      headers: d1Headers,
    }).catch((err) => {
      logger.error("Background D1 position-record write failed", {
        positionId: posId,
        error: toError(err),
      });
    });

    if (ctx) {
      // Non-blocking: the response returns to the caller immediately
      // while the D1 writes happen in the background. ctx.waitUntil
      // keeps the worker alive until both writes settle.
      ctx.waitUntil(Promise.all([tradeWrite, posWrite]));
    } else {
      // Fallback for callers without an ExecutionContext (tests,
      // internal callers): block until the writes complete so we
      // don't drop them on the floor.
      await Promise.all([tradeWrite, posWrite]);
    }
