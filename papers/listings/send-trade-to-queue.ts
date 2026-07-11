// Source: workers/hoox/src/logic.ts (lines 97-114)
// Listing id: send-trade-to-queue
// Caption: Queue producer message envelope
export async function sendTradeToQueue(
  queue: Queue,
  tradeData: TradeData,
  logger: Logger
): Promise<void> {
  const message = {
    requestId: tradeData.requestId,
    exchange: tradeData.exchange,
    action: tradeData.action,
    symbol: tradeData.symbol,
    quantity: tradeData.quantity,
    price: tradeData.price,
    leverage: tradeData.leverage,
    queuedAt: new Date().toISOString(),
  };
  await queue.send(message);
  logger.info(`[${tradeData.requestId}] Trade sent to queue`);
}
