// Source: workers/trade-worker/src/exchange-connection-manager.ts (lines 17-52)
// Listing id: exchange-connection-do
// Caption: ExchangeConnectionManager DO: WS adapter and pending RPC map
export class ExchangeConnectionManager extends DurableObject {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private exchange: string;
  private adapter: IWsAdapter | undefined;
  private ready = false;
  private pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.exchange = this.deriveExchange(ctx);

    // Load the configured adapter for this exchange, if creds are available.
    const apiKey = readApiKey(env, this.exchange);
    const apiSecret = readApiSecret(env, this.exchange);
    if (apiKey && apiSecret) {
      this.adapter = getAdapter(this.exchange, { apiKey, apiSecret });
      if (!this.adapter) {
        logger.warn(
          `No WS adapter registered for "${this.exchange}"; DO is REST-only`
        );
      }
    } else {
      logger.warn(`Missing ${this.exchange} credentials; DO is REST-only`);
    }

    // Kick off connection in background
    this.ctx.waitUntil(this.connectToExchange());
  }
