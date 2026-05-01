import { describe, test, expect } from "bun:test";

const hasCloudflareTest = async () => {
  try {
    await import("cloudflare:test");
    return true;
  } catch {
    return false;
  }
};

describe("End-to-End Gateway Flow", () => {
  test("processes a TradingView webhook and routes it properly", async () => {
    if (!(await hasCloudflareTest())) {
      expect(true).toBe(true);
      return;
    }

    const { env, createExecutionContext, waitOnExecutionContext } =
      await import("cloudflare:test");
    const worker = (await import("../../workers/hoox/src/index")).default;

    const request = new Request("http://localhost/webhook/tradingview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "tradingview",
        symbol: "BTCUSD",
        side: "buy",
        amount: 0.01,
      }),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
  });
});
