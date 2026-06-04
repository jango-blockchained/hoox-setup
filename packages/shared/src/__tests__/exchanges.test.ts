import { describe, it, expect } from "bun:test";
import {
  BaseExchangeClient,
  type TradeParams,
  type OrderResponse,
  type Position,
} from "../exchanges/base-exchange-client";

describe("BaseExchangeClient", () => {
  it("should instantiate with API credentials", () => {
    class TestClient extends BaseExchangeClient {
      protected getDefaultBaseUrl(): string {
        return "https://api.test.com";
      }

      protected async generateSignature(
        _params: Record<string, string | number | boolean>
      ): Promise<string> {
        return "test-signature";
      }

      protected buildHeaders(
        _method: string,
        _path: string,
        _params?: Record<string, string | number | boolean>
      ): Headers {
        return new Headers();
      }

      async setLeverage(_symbol: string, _leverage: number): Promise<void> {
        // Test implementation
      }

      async executeTrade(_params: TradeParams): Promise<OrderResponse> {
        return {
          orderId: "test-order",
          symbol: "BTC/USDT",
          status: "filled",
        };
      }

      async getAccountInfo(): Promise<Record<string, unknown>> {
        return { balance: 1000 };
      }

      async getPositions(_symbol?: string): Promise<Position[]> {
        return [];
      }
    }

    const client = new TestClient("test-key", "test-secret");
    expect(client).toBeInstanceOf(TestClient);
  });

  it("should throw error if API key is missing", () => {
    class TestClient extends BaseExchangeClient {
      protected getDefaultBaseUrl(): string {
        return "https://api.test.com";
      }

      protected async generateSignature(
        _params: Record<string, string | number | boolean>
      ): Promise<string> {
        return "test-signature";
      }

      protected buildHeaders(
        _method: string,
        _path: string,
        _params?: Record<string, string | number | boolean>
      ): Headers {
        return new Headers();
      }

      async setLeverage(_symbol: string, _leverage: number): Promise<void> {
        // Test implementation
      }

      async executeTrade(_params: TradeParams): Promise<OrderResponse> {
        return {
          orderId: "test-order",
          symbol: "BTC/USDT",
          status: "filled",
        };
      }

      async getAccountInfo(): Promise<Record<string, unknown>> {
        return { balance: 1000 };
      }

      async getPositions(_symbol?: string): Promise<Position[]> {
        return [];
      }
    }

    expect(() => new TestClient("", "test-secret")).toThrow(
      "API key and secret are required."
    );
  });

  it("should throw error if API secret is missing", () => {
    class TestClient extends BaseExchangeClient {
      protected getDefaultBaseUrl(): string {
        return "https://api.test.com";
      }

      protected async generateSignature(
        _params: Record<string, string | number | boolean>
      ): Promise<string> {
        return "test-signature";
      }

      protected buildHeaders(
        _method: string,
        _path: string,
        _params?: Record<string, string | number | boolean>
      ): Headers {
        return new Headers();
      }

      async setLeverage(_symbol: string, _leverage: number): Promise<void> {
        // Test implementation
      }

      async executeTrade(_params: TradeParams): Promise<OrderResponse> {
        return {
          orderId: "test-order",
          symbol: "BTC/USDT",
          status: "filled",
        };
      }

      async getAccountInfo(): Promise<Record<string, unknown>> {
        return { balance: 1000 };
      }

      async getPositions(_symbol?: string): Promise<Position[]> {
        return [];
      }
    }

    expect(() => new TestClient("test-key", "")).toThrow(
      "API key and secret are required."
    );
  });
});
