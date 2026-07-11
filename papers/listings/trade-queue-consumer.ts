// Source: workers/trade-worker/src/index.ts (lines 271-300)
// Listing id: trade-queue-consumer
// Caption: trade-worker queue consumer wiring
  async queue(
    batch: MessageBatch<TradeQueueMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const handler = createQueueHandler<TradeQueueMessage>({
      maxRetries: MAX_RETRIES,
      backoffDelays: BACKOFF_DELAYS,
      logger,
      onMessage: async (trade, _attemptNumber) => {
        const result = await executeTradeFromQueue(trade, env, ctx);
        if (!result.success) {
          throw new Error(result.error || "Trade execution failed");
        }
        await sendTradeNotification(trade, env, result);
      },
      onRetry: (_trade, _attemptNumber, _errorMsg, _delaySeconds) => {
        // Logging is handled by createQueueHandler internally
      },
      onDLQ: async (trade, _attemptNumber, errorMsg) => {
        await logFailedTrade(trade, errorMsg, env);
        await sendTradeNotification(trade, env, {
          success: false,
          error: errorMsg,
        });
      },
    });

    return await handler(batch);
  },
