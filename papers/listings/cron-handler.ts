// Source: packages/shared/src/cron-handler.ts (lines 39-65)
// Listing id: cron-handler
// Caption: Shared cron handler with structured logging
export function createCronHandler<Env = unknown>(
  options: CronHandlerOptions<Env>
) {
  const { name, handler, logger } = options;

  return async (
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> => {
    const startTime = Date.now();

    logger?.info(`${name} cron triggered`, {
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    });

    try {
      await handler(event, env, ctx);

      const durationMs = Date.now() - startTime;
      logger?.info(`${name} cron handler completed successfully`, {
        cron: event.cron,
        durationMs,
      });
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
