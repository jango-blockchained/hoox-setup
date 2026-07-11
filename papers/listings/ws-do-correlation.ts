// Source: workers/trade-worker/src/exchange-connection-manager.ts (lines 159-189)
// Listing id: ws-do-correlation
// Caption: WS request/response correlation via pending map and timeout
  async request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 5_000
  ): Promise<unknown> {
    if (!this.ws) throw new Error("WS not connected");
    if (!this.adapter) throw new Error(`No adapter for ${this.exchange}`);

    const envelope = await this.adapter.buildRequest(method, params);
    // Extract the correlation id (Binance/MEXC use `id`, Bybit uses `reqId`).
    const parsed = JSON.parse(envelope) as Record<string, unknown>;
    const key = (parsed.id ?? parsed.reqId) as string | undefined;
    if (typeof key !== "string") {
      throw new Error("Adapter produced no correlation id");
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        reject(new Error(`WS ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(key, { resolve, reject, timer });
      try {
        this.ws!.send(envelope);
      } catch (err) {
        this.pending.delete(key);
        clearTimeout(timer);
        reject(err);
      }
    });
  }
