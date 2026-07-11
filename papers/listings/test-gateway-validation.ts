// Source: tests/integration/gateway.test.ts (lines 22-64)
// Listing id: test-gateway-validation
// Caption: Zod + validateJson rejects invalid TradingView payloads
  test("validates a real TradingView webhook payload", () => {
    const tradingViewPayload = {
      exchange: "binance",
      action: "LONG" as const,
      symbol: "BTC/USDT",
      quantity: 0.5,
      price: 50000,
      orderType: "market",
      leverage: 20,
    };
    const result = validateJson(WebhookPayloadSchema, tradingViewPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.symbol).toBe("BTC/USDT");
      expect(result.value.action).toBe("LONG");
    }
  });

  test("rejects TradingView payload with missing fields", () => {
    const result = validateJson(WebhookPayloadSchema, {
      exchange: "test",
      // missing symbol, action, quantity
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("symbol");
      expect(result.error).toContain("action");
      expect(result.error).toContain("quantity");
    }
  });

  test("validateJson + TradeActionSchema rejects invalid trade action", () => {
    const result = validateJson(WebhookPayloadSchema, {
      exchange: "binance",
      action: "HOLD", // invalid -- not in the enum
      symbol: "BTC/USDT",
      quantity: 0.1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("action");
    }
  });
