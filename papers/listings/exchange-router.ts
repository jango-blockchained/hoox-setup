// Source: workers/trade-worker/src/exchange-router.ts (lines 107-167)
// Listing id: exchange-router
// Caption: Dynamic KV routing and exchange toggle resolution
  async route(
    payload: WebhookPayload,
    env: Env
  ): Promise<{
    exchange: string;
    client: IExchangeClient;
    useWebsocketDO?: boolean;
  }> {
    let exchange = payload.exchange.toLowerCase();
    let useWebsocketDO = false;

    // Check KV for dynamic routing
    if (env.CONFIG_KV) {
      try {
        const routingTableStr = await env.CONFIG_KV.get(
          KVKeys.KV_TRADE_ROUTING
        );
        if (routingTableStr) {
          const routingTable = JSON.parse(routingTableStr);
          if (routingTable[payload.symbol]) {
            exchange = routingTable[payload.symbol].toLowerCase();
            logger.info("Dynamic route for symbol", {
              symbol: payload.symbol,
              exchange,
            });
          }
        }
      } catch (e) {
        logger.error("Failed to parse routing table from KV", {
          error: toError(e),
        });
      }

      // Check exchange toggle and websocket mode in parallel
      try {
        const [exchangeEnabled, useWs] = await Promise.all([
          env.CONFIG_KV.get(`exchange:${exchange}:enabled`),
          env.CONFIG_KV.get(`exchange:${exchange}:use_websocket`),
        ]);

        if (exchangeEnabled === "false") {
          throw new Error(`EXCHANGE_DISABLED: ${exchange} is disabled`);
        }

        if (useWs === "true") {
          useWebsocketDO = true;
        }
      } catch (e) {
        // Re-throw EXCHANGE_DISABLED errors, swallow and log KV failures
        if (e instanceof Error && e.message.startsWith("EXCHANGE_DISABLED")) {
          throw e;
        }
        logger.error("Failed to check exchange toggle from KV", {
          error: toError(e),
        });
      }
    }

    const baseResult = this.baseRouter.route(exchange, env);
    return { ...baseResult, useWebsocketDO };
  }
