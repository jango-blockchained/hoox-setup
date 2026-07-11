// Source: workers/trade-worker/src/wsAdapters/types.ts (lines 37-66)
// Listing id: ws-adapter-interface
// Caption: IWsAdapter interface: buildRequest and parseResponse contract
export interface IWsAdapter {
  /** WebSocket endpoint URL (e.g. `wss://ws-api.binance.com:443/ws-api/v3`). */
  readonly url: string;

  /**
   * Build the outbound string to `ws.send(...)` for a logical request.
   *
   * Async because some exchanges (Binance) require per-request HMAC-SHA256
   * signing, and WebCrypto's `crypto.subtle.sign` is promise-based. Adapters
   * that don't need to sign can simply `return Promise.resolve(envelope)`.
   *
   * @param method  Logical method name (e.g. `"order.place"`). The adapter
   *                decides how to translate this into its exchange's envelope.
   * @param params  Method parameters. May be signed inside the adapter
   *                using the credentials bound at construction time.
   * @returns       String ready to be passed to `ws.send()`.
   */
  buildRequest(
    method: string,
    params: Record<string, unknown>
  ): Promise<string>;

  /**
   * Parse an inbound WS message.
   *
   * @returns A `WsResponse` if the message is a response to a
   *          previously-sent request (caller routes by `id`), or `null`
   *          if the message is a push event the DO doesn't track.
   */
  parseResponse(raw: string): WsResponse | null;
