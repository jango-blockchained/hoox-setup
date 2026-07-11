// Source: packages/shared/src/queue-handler.ts (lines 53-91)
// Listing id: queue-handler
// Caption: Shared queue consumer with exponential backoff and DLQ hook
export function createQueueHandler<T>(options: QueueHandlerOptions<T>) {
  const { maxRetries, backoffDelays, onMessage, onRetry, onDLQ, logger } =
    options;

  return async (batch: MessageBatch<T>): Promise<void> => {
    for (const msg of batch.messages) {
      const attemptNumber = msg.attempts || 0;
      const logId = `[${msg.id}]`;

      try {
        logger?.info(
          `${logId} Processing message (attempt ${attemptNumber + 1})`
        );
        await onMessage(msg.body, attemptNumber);
        logger?.info(`${logId} Message processed successfully`);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attemptNumber < maxRetries) {
          const delaySeconds =
            backoffDelays[attemptNumber] ??
            backoffDelays[backoffDelays.length - 1];

          logger?.info(
            `${logId} Retrying in ${delaySeconds}s (attempt ${attemptNumber + 2}/${maxRetries + 1})`
          );

          await onRetry?.(msg.body, attemptNumber, errorMsg, delaySeconds);
          msg.retry({ delaySeconds });
        } else {
          logger?.error(
            `${logId} Max retries exceeded (${maxRetries + 1} attempts), moving to DLQ`
          );

          await onDLQ?.(msg.body, attemptNumber, errorMsg);
        }
      }
    }
  };
