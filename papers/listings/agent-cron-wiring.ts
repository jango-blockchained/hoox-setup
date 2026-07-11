// Source: workers/agent-worker/src/index.ts (lines 288-306)
// Listing id: agent-cron-wiring
// Caption: agent-worker cron handler with parallel housekeeping and routine
const cronHandler = createCronHandler<Env>({
  name: "agent-worker",
  logger,
  handler: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(
      runHousekeeping(env as unknown as HousekeepingEnv, logger).catch((err) =>
        logger.error("runHousekeeping failed", { error: String(err) })
      )
    );
    ctx.waitUntil(
      processRoutine(env as unknown as RoutineEnv, logger, {
        getProviderManager: (e) => getProviderManager(e as unknown as Env),
        getActiveTrailingStops: (e) =>
          getActiveTrailingStops(e as unknown as Env),
      }).catch((err) =>
        logger.error("processRoutine failed", { error: String(err) })
      )
    );
  },
