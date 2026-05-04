import { buildDataPoint } from "../src/helpers";
import { describe, test, expect } from "bun:test";

describe("buildDataPoint", () => {
  test("buildDataPoint.trade creates correct data point", () => {
    const dp = buildDataPoint.trade(
      { exchange: "binance", action: "LONG", symbol: "BTCUSDT", quantity: 0.5, price: 45000, requestId: "req-123" },
      { success: true },
      1200
    );
    
    expect(dp.blobs[0]).toBe("trade");
    expect(dp.blobs[1]).toBe("trade-worker");
    expect(dp.blobs[2]).toBe("success");
    expect(dp.doubles[0]).toBe(0.5);
    expect(dp.doubles[2]).toBe(1200);
  });

  test("buildDataPoint.apiCall creates correct data point", () => {
    const dp = buildDataPoint.apiCall("trade-worker", "/api/v3/order", 250, true);
    
    expect(dp.blobs[0]).toBe("api-call");
    expect(dp.blobs[3]).toBe("/api/v3/order");
    expect(dp.doubles[0]).toBe(250);
  });
});
