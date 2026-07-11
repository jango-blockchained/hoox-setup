// Source: workers/trade-worker/src/wsAdapters/adapters.ts (lines 20-39)
// Listing id: ws-adapter-registry
// Caption: Per-exchange WS adapter factory registry
const REGISTRY: Record<string, AdapterCtor> = {
  binance: BinanceAdapter,
  bybit: BybitAdapter,
  mexc: MexcAdapter,
};

/**
 * Construct a configured WS adapter for the given exchange.
 *
 * @param exchange Exchange name (case-insensitive)
 * @param creds    API key/secret to bind to the adapter
 * @returns        A fresh adapter instance, or `undefined` if the exchange
 *                 has no registered adapter.
 */
export function getAdapter(
  exchange: string,
  creds: { apiKey: string; apiSecret: string }
): IWsAdapter | undefined {
  const Ctor = REGISTRY[exchange.toLowerCase()];
  return Ctor ? new Ctor(creds) : undefined;
