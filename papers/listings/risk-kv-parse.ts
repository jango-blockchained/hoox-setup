// Source: workers/trade-worker/src/execution.ts (lines 307-379)
// Listing id: risk-kv-parse
// Caption: Parallel KV risk reads with NaN-safe leverage/size parsing
    // --- Kill Switch & Risk Management via CONFIG_KV ---
    // Read all independent KV keys in parallel
    if (env.CONFIG_KV) {
      try {
        const [killSwitch, defaultLevStr, maxSizeStr] = await Promise.all([
          env.CONFIG_KV.get(KVKeys.KV_TRADE_KILL_SWITCH),
          env.CONFIG_KV.get(KVKeys.KV_TRADE_DEFAULT_LEVERAGE),
          env.CONFIG_KV.get(KVKeys.KV_TRADE_MAX_POSITION_SIZE),
        ]);

        if (killSwitch === "true") {
          throw new Error(
            "KILL_SWITCH_ACTIVE: Trading is disabled by kill switch"
          );
        }

        // Parse leverage safely. A malformed KV value (empty string,
        // "abc", etc.) yields NaN from parseInt; NaN bypasses every
        // later bound check (NaN > anyNumber === false), silently
        // disabling the per-trade leverage cap. The same is true for
        // parseFloat on the position-size KV value.
        if (defaultLevStr && !overriddenLeverage) {
          const parsedLev = parseInt(defaultLevStr, 10);
          if (Number.isFinite(parsedLev) && parsedLev > 0) {
            overriddenLeverage = parsedLev;
            logger.info(
              `[Risk Management] Applied default leverage: ${overriddenLeverage}`
            );
          } else {
            logger.warn(
              `[Risk Management] Ignoring malformed default_leverage value: ${JSON.stringify(defaultLevStr)}`
            );
          }
        }
        if (maxSizeStr) {
          const parsedSize = parseFloat(maxSizeStr);
          if (Number.isFinite(parsedSize) && parsedSize > 0) {
            maxPositionSize = parsedSize;
          } else {
            logger.warn(
              `[Risk Management] Ignoring malformed max_position_size value: ${JSON.stringify(maxSizeStr)}`
            );
          }
        }
      } catch (e) {
        // Re-throw kill switch errors, swallow and log KV failures
        if (e instanceof Error && e.message.startsWith("KILL_SWITCH_ACTIVE")) {
          throw e;
        }
        logger.error("Failed to fetch trade settings from KV", {
          error: toError(e),
        });
      }
    }
    // --- End Kill Switch & Risk Management ---

    if (maxPositionSize !== null && quantity > maxPositionSize) {
      const errorMsg = `Trade quantity (${quantity}) exceeds maximum allowed size (${maxPositionSize})`;
      logger.error(errorMsg);
      const result: TradeExecutionResult = {
        success: false,
        error: errorMsg,
        status: 400,
      };
      await dbLogger.logResponse(
        dbLogId,
        createJsonResponse(result, 400),
        null,
        startTime,
        ctx
      );
      return result;
    }
