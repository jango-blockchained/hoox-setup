import { describe, it, expect } from "bun:test";
import {
  BaseExchangeClient,
  type TradeResult,
} from "../exchanges/base-exchange-client";

describe("BaseExchangeClient", () => {
  it("should instantiate with configuration", () => {
    class TestClient extends BaseExchangeClient {
      async validateApiCredentials(): Promise<boolean> {
        return true;
      }

      async executeTrade(
        _symbol: string,
        _action: "buy" | "sell",
        _quantity: number,
        _price?: number,
        _leverage?: number
      ): Promise<TradeResult> {
        return { success: true };
      }

      async getMarkPrice(): Promise<number> {
        return 100;
      }

      async getOpenPositions(): Promise<unknown[]> {
        return [];
      }

      async closePosition(): Promise<unknown> {
        return { success: true };
      }

      async getWalletBalance(): Promise<number> {
        return 1000;
      }
    }

    const client = new TestClient({
      apiKey: "test-key",
      apiSecret: "test-secret",
      exchange: "test-exchange",
    });

    expect(client.exchange).toBe("test-exchange");
  });

  it("should support sandbox mode", () => {
    class TestClient extends BaseExchangeClient {
      async validateApiCredentials(): Promise<boolean> {
        return true;
      }

      async executeTrade(
        _symbol: string,
        _action: "buy" | "sell",
        _quantity: number,
        _price?: number,
        _leverage?: number
      ): Promise<TradeResult> {
        return { success: true };
      }

      async getMarkPrice(): Promise<number> {
        return 100;
      }

      async getOpenPositions(): Promise<unknown[]> {
        return [];
      }

      async closePosition(): Promise<unknown> {
        return { success: true };
      }

      async getWalletBalance(): Promise<number> {
        return 1000;
      }

      // Expose protected property for testing
      isSandbox(): boolean {
        return this.sandbox;
      }
    }

    const client = new TestClient({
      apiKey: "test-key",
      apiSecret: "test-secret",
      exchange: "test-exchange",
      sandbox: true,
    });

    expect(client.isSandbox()).toBe(true);
  });

  it("should build URLs correctly", () => {
    class TestClient extends BaseExchangeClient {
      async validateApiCredentials(): Promise<boolean> {
        return true;
      }

      async executeTrade(
        _symbol: string,
        _action: "buy" | "sell",
        _quantity: number,
        _price?: number,
        _leverage?: number
      ): Promise<TradeResult> {
        return { success: true };
      }

      async getMarkPrice(): Promise<number> {
        return 100;
      }

      async getOpenPositions(): Promise<unknown[]> {
        return [];
      }

      async closePosition(): Promise<unknown> {
        return { success: true };
      }

      async getWalletBalance(): Promise<number> {
        return 1000;
      }

      // Expose protected method for testing
      testBuildUrl(path: string): string {
        return this.buildUrl(path);
      }
    }

    const prodClient = new TestClient({
      apiKey: "key",
      apiSecret: "secret",
      exchange: "binance",
    });

    const sandboxClient = new TestClient({
      apiKey: "key",
      apiSecret: "secret",
      exchange: "binance",
      sandbox: true,
    });

    expect(prodClient.testBuildUrl("/api/v1/trades")).toBe(
      "https://binance.example.com/api/v1/trades"
    );
    expect(sandboxClient.testBuildUrl("/api/v1/trades")).toBe(
      "https://sandbox-binance.example.com/api/v1/trades"
    );
  });
});
