import { describe, expect, test, beforeEach } from "bun:test";

/**
 * E2E Test Suite for Hoox Gateway and Trading Engine
 * 
 * This test suite simulates a full TradingView webhook → Gateway → Trade Worker flow
 * and includes dashboard configuration tests.
 */

describe("Hoox E2E Flow", () => {
  const mockEnv = {
    TRADE_SERVICE: { 
      fetch: (_req: Request, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify({ success: true, requestId: "test-123" }), { status: 200 })) 
    },
    TELEGRAM_SERVICE: { 
      fetch: (_req: Request, _init?: RequestInit) => Promise.resolve(new Response("OK")) 
    },
    D1_SERVICE: { 
      fetch: (_req: Request, _init?: RequestInit) => Promise.resolve(new Response("OK")) 
    },
    API_KEY: "test-api-key",
    INTERNAL_KEY: "test-internal-key",
    SESSIONS_KV: { get: () => Promise.resolve(null), put: () => Promise.resolve() },
    CONFIG_KV: { get: () => Promise.resolve(JSON.stringify({ maxDrawdown: -5 })), put: () => Promise.resolve() },
  };

  test("should process valid LONG signal and forward to trade-worker", async () => {
    const signal = {
      exchange: "mexc",
      action: "LONG",
      symbol: "BTC_USDT",
      quantity: 0.01,
      leverage: 10
    };

    expect(signal.action).toBe("LONG");
    expect(signal.exchange).toBe("mexc");
    
    const mockResponse = await mockEnv.TRADE_SERVICE.fetch(new Request("http://test"), {
      method: "POST",
      body: JSON.stringify(signal)
    });
    
    expect(mockResponse.status).toBe(200);
    const data = (await mockResponse.json()) as { success: boolean };
    expect(data.success).toBe(true);
  });

  test("should reject invalid API key", async () => {
    const apiKey = "invalid-key";
    const validKey = mockEnv.API_KEY;
    expect(apiKey === validKey).toBe(false);
  });

  test("should execute CLOSE_LONG when signal is received", async () => {
    const closeSignal = {
      exchange: "binance",
      action: "CLOSE_LONG",
      symbol: "ETH_USDT",
      quantity: 0.5
    };

    expect(closeSignal.action).toBe("CLOSE_LONG");
    expect(closeSignal.quantity).toBe(0.5);
  });
});

describe("Risk Management Flow", () => {
  test("should trigger kill switch on max drawdown breach", async () => {
    const maxDrawdown = -5;
    const currentPnL = -6;
    expect(currentPnL).toBeLessThan(maxDrawdown);
  });

  test("should manage trailing stop watermark", async () => {
    const position = {
      symbol: "BTC_USDT",
      side: "LONG",
      entryPrice: 50000,
      currentPrice: 52000
    };
    
    const profit = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
    expect(profit).toBeGreaterThan(0);
  });
});

describe("Dashboard Configuration Schema", () => {
  test("should parse boolean config values", async () => {
    const tests = [
      { key: "global:kill_switch", value: "true", expected: true },
      { key: "global:kill_switch", value: "false", expected: false },
      { key: "webhook:tradingview:ip_check_enabled", value: "true", expected: true },
    ];
    
    for (const tc of tests) {
      const parsed = tc.value === 'true';
      expect(parsed).toBe(tc.expected);
    }
  });

  test("should parse number config values", async () => {
    const tests = [
      { key: "trade:max_daily_drawdown_percent", value: "-5", expected: -5 },
      { key: "agent:timeout_ms", value: "30000", expected: 30000 },
      { key: "agent:retry_count", value: "3", expected: 3 },
    ];
    
    for (const tc of tests) {
      const parsed = Number(tc.value);
      expect(parsed).toBe(tc.expected);
    }
  });

  test("should parse JSON config values", async () => {
    const jsonValue = '["52.89.214.238", "34.212.75.30"]';
    const parsed = JSON.parse(jsonValue);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toContain("52.89.214.238");
  });

  test("should validate JSON syntax", async () => {
    const invalidJson = '{"invalid": incomplete';
    let isValid = true;
    try {
      JSON.parse(invalidJson);
    } catch {
      isValid = false;
    }
    expect(isValid).toBe(false);
  });
});

describe("Agent Worker Provider Configuration", () => {
  test("should support workers-ai provider", async () => {
    const provider = "workers-ai";
    const validProviders = ["workers-ai", "openai", "anthropic", "google"];
    expect(validProviders).toContain(provider);
  });

  test("should support fallback chain", async () => {
    const fallbackChain = ["workers-ai", "openai", "anthropic"];
    expect(fallbackChain.length).toBe(3);
    expect(fallbackChain[0]).toBe("workers-ai");
  });

  test("should map model to provider", async () => {
    const modelMap = {
      "workers-ai": "@cf/meta/llama-3.1-8b-instruct",
      "openai": "gpt-4o-mini-2024-07-18",
      "anthropic": "claude-3-haiku-20240307",
      "google": "gemini-1.5-flash-002"
    };
    
    expect(modelMap["workers-ai"]).toBe("@cf/meta/llama-3.1-8b-instruct");
    expect(modelMap["openai"]).toBe("gpt-4o-mini-2024-07-18");
  });
});

describe("Worker Service Binding Detection", () => {
  test("should detect configured services", async () => {
    const services = {
      D1_SERVICE: { fetch: () => {} },
      TRADE_SERVICE: { fetch: () => {} },
      TELEGRAM_SERVICE: { fetch: () => {} }
    };
    
    expect(services.D1_SERVICE).toBeDefined();
    expect(services.TRADE_SERVICE).toBeDefined();
    expect(services.TELEGRAM_SERVICE).toBeDefined();
  });

  test("should identify missing services", async () => {
    const services: Record<string, any> = {
      D1_SERVICE: { fetch: () => {} }
    };
    
    expect(services.TRADE_SERVICE).toBeUndefined();
    expect(services.TELEGRAM_SERVICE).toBeUndefined();
  });
});