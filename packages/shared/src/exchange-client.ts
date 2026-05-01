export type ExchangeName = "binance" | "mexc" | "bybit";

export interface ExchangeConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  testnet?: boolean;
}

export interface TradeParams {
  symbol: string;
  side: "long" | "short";
  orderType?: string;
  quantity: number;
  price?: number;
  reduceOnly?: boolean;
  leverage?: number;
}

export interface OrderResponse {
  orderId: string;
  symbol: string;
  status: string;
  executedQty?: string;
  price?: string;
}

export interface Position {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  unrealizedPnl?: number;
}

export abstract class BaseExchangeClient {
  protected readonly apiKey: string;
  protected readonly apiSecret: string;
  protected readonly baseUrl: string;
  protected readonly isTestnet: boolean;

  constructor(config: ExchangeConfig) {
    if (!config.apiKey || !config.apiSecret) {
      throw new Error("API key and secret are required.");
    }
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl();
    this.isTestnet = config.testnet || false;
  }

  protected abstract getDefaultBaseUrl(): string;

  protected abstract generateSignature(
    params: Record<string, string | number | boolean>
  ): Promise<string>;

  protected abstract buildHeaders(
    method: string,
    path: string,
    params?: Record<string, string | number | boolean>
  ): Headers;

  protected async fetch<T>(
    method: string,
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.buildHeaders(method, path, params);
    const body = params
      ? new URLSearchParams(params as Record<string, string>).toString()
      : undefined;

    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? body : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Exchange API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  public abstract setLeverage(symbol: string, leverage: number): Promise<void>;

  public abstract executeTrade(params: TradeParams): Promise<OrderResponse>;

  public abstract getAccountInfo(): Promise<Record<string, unknown>>;

  public abstract getPositions(symbol?: string): Promise<Position[]>;

  public async openLong(
    symbol: string,
    quantity: number,
    price?: number,
    orderType = "MARKET"
  ): Promise<OrderResponse> {
    return this.executeTrade({
      symbol,
      side: "long",
      orderType,
      quantity,
      price,
    });
  }

  public async openShort(
    symbol: string,
    quantity: number,
    price?: number,
    orderType = "MARKET"
  ): Promise<OrderResponse> {
    return this.executeTrade({
      symbol,
      side: "short",
      orderType,
      quantity,
      price,
    });
  }

  public async closeLong(
    symbol: string,
    quantity: number
  ): Promise<OrderResponse> {
    return this.executeTrade({
      symbol,
      side: "long",
      quantity,
      reduceOnly: true,
    });
  }

  public async closeShort(
    symbol: string,
    quantity: number
  ): Promise<OrderResponse> {
    return this.executeTrade({
      symbol,
      side: "short",
      quantity,
      reduceOnly: true,
    });
  }
}
