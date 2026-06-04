export interface ExchangeClientConfig {
  apiKey: string;
  apiSecret: string;
  exchange: string;
  sandbox?: boolean;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  error?: string;
  result?: unknown;
}

/**
 * Base class for exchange clients. All exchange implementations must extend this.
 */
export abstract class BaseExchangeClient {
  protected apiKey: string;
  protected apiSecret: string;
  public readonly exchange: string;
  protected sandbox: boolean;

  constructor(config: ExchangeClientConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.exchange = config.exchange;
    this.sandbox = config.sandbox ?? false;
  }

  abstract validateApiCredentials(): Promise<boolean>;
  abstract executeTrade(
    symbol: string,
    action: "buy" | "sell",
    quantity: number,
    price?: number,
    leverage?: number
  ): Promise<TradeResult>;
  abstract getMarkPrice(symbol: string): Promise<number>;
  abstract getOpenPositions(symbol?: string): Promise<unknown[]>;
  abstract closePosition(symbol: string, positionId?: string): Promise<unknown>;
  abstract getWalletBalance(): Promise<number>;

  protected buildUrl(path: string): string {
    const baseUrl = this.sandbox
      ? `https://sandbox-${this.exchange}.example.com`
      : `https://${this.exchange}.example.com`;
    return `${baseUrl}${path}`;
  }

  protected async makeRequest(
    _method: string,
    _path: string,
    _data?: unknown
  ): Promise<unknown> {
    // Subclasses implement via own HTTP client
    throw new Error("makeRequest must be implemented by subclass");
  }
}
