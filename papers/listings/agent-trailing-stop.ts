// Source: workers/agent-worker/src/logic/routine.ts (lines 107-198)
// Listing id: agent-trailing-stop
// Caption: Batched mark prices, KV watermarks, trailing-stop trigger
    // Batch all mark price fetches in parallel before the loop
    const markPriceResults = await Promise.all(
      openPositions.map((pos) =>
        fetchMarkPrice(pos.exchange, pos.symbol, logger)
      )
    );
    const markPriceMap = new Map<number, number | null>();
    openPositions.forEach((pos, i) => {
      markPriceMap.set(i, markPriceResults[i]);
    });

    // Batch all KV watermark reads in parallel before the loop
    const watermarkKeys = openPositions.map(
      (pos) => `trade:watermark:${pos.exchange}:${pos.symbol}:${pos.side}`
    );
    const wmResults = await Promise.all(
      watermarkKeys.map((key) => env.CONFIG_KV.get(key))
    );
    const watermarkMap = new Map<number, string | null>();
    wmResults.forEach((val, i) => {
      watermarkMap.set(i, val);
    });

    // Batch all TP hit KV reads in parallel
    const tpKeys = openPositions.map(
      (pos) => `trade:tp_hit:${pos.exchange}:${pos.symbol}:${pos.side}`
    );
    const tpResults = await Promise.all(
      tpKeys.map((key) => env.CONFIG_KV.get(key))
    );
    const tpHitMap = new Map<number, string | null>();
    tpResults.forEach((val, i) => {
      tpHitMap.set(i, val);
    });

    // Process positions sequentially for state-dependent writes
    for (let i = 0; i < openPositions.length; i++) {
      const position = openPositions[i];
      logger.info(
        `Analyzing position: ${position.symbol} (${position.side}) - Quantity: ${position.size}`
      );

      const markPrice = markPriceMap.get(i) ?? null;

      if (markPrice !== null) {
        logger.info(
          `${position.exchange} ${position.symbol} Mark Price: ${markPrice}`
        );
        if (position.entry_price && position.size) {
          const priceDiff =
            position.side === "LONG"
              ? markPrice - position.entry_price
              : position.entry_price - markPrice;
          const pnl = priceDiff * position.size;
          totalUnrealizedPnl += pnl;
          logger.info(`Unrealized PnL for ${position.symbol}: ${pnl}`);

          const currentWmStr = watermarkMap.get(i) ?? null;
          const currentWm = currentWmStr
            ? parseFloat(currentWmStr)
            : position.entry_price;

          let newWm = currentWm;
          if (position.side === "LONG" && markPrice > currentWm)
            newWm = markPrice;
          if (position.side === "SHORT" && markPrice < currentWm)
            newWm = markPrice;

          const wmKey = `trade:watermark:${position.exchange}:${position.symbol}:${position.side}`;
          if (newWm !== currentWm) {
            await env.CONFIG_KV.put(wmKey, newWm.toString());
          }

          const trailingStopPercent = config.trailingStopPercent;
          let triggerStop = false;
          if (
            position.side === "LONG" &&
            markPrice < newWm * (1 - trailingStopPercent)
          )
            triggerStop = true;
          if (
            position.side === "SHORT" &&
            markPrice > newWm * (1 + trailingStopPercent)
          )
            triggerStop = true;

          if (triggerStop) {
            logger.info(
              `TRAILING STOP TRIGGERED for ${position.symbol}! Watermark: ${newWm}, Current: ${markPrice}`
            );
            await sendCloseOrder(env, position, logger);
            void trackAnalytics(env, "/track/trailing-stop", {
