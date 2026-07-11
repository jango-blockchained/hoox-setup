// Source: workers/trade-worker/src/wsAdapters/binance.ts (lines 48-96)
// Listing id: ws-adapter-binance
// Caption: Binance WS API v3 adapter: per-request HMAC signing
export class BinanceAdapter implements IWsAdapter {
  readonly url = "wss://ws-api.binance.com:443/ws-api/v3";

  constructor(private readonly creds: { apiKey: string; apiSecret: string }) {}

  async buildRequest(
    method: string,
    params: Record<string, unknown>
  ): Promise<string> {
    const id = crypto.randomUUID();
    const flat = sortedParams({
      apiKey: this.creds.apiKey,
      timestamp: Date.now(),
      ...params,
    });
    const query = new URLSearchParams(flat).toString();
    const signature = await sign(this.creds.apiSecret, query);

    return JSON.stringify({
      id,
      method,
      params: { ...flat, signature },
    });
  }

  parseResponse(raw: string): WsResponse | null {
    let msg: {
      id?: unknown;
      status?: unknown;
      result?: unknown;
      error?: { code?: unknown; msg?: unknown };
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!msg || typeof msg.id !== "string") return null; // push event
    if (msg.error) {
      return {
        id: msg.id,
        error: {
          code: Number(msg.error.code ?? 0),
          msg: String(msg.error.msg ?? ""),
        },
      };
    }
    return { id: msg.id, result: msg.result };
  }
