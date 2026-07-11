// Source: workers/trade-worker/test/d1-fire-and-forget.test.ts (lines 140-172)
// Listing id: test-d1-fire-and-forget
// Caption: Regression test: D1 writes dispatched via waitUntil
  it("dispatches D1 writes via ctx.waitUntil when ctx is provided", async () => {
    const t0 = Date.now();
    await update(
      {
        D1_SERVICE: {} as Fetcher,
        INTERNAL_KEY_BINDING: "test-internal-key",
      },
      { action: "LONG", symbol: "BTCUSDT", quantity: 0.001, price: 60000 },
      "binance",
      10,
      mockCtx as unknown as ExecutionContext
    );
    const elapsed = Date.now() - t0;

    // The function returned essentially immediately (no D1 round
    // trips were awaited). Allow a generous 50ms for test noise.
    expect(elapsed).toBeLessThan(50);

    // ctx.waitUntil was called with the writes
    expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1);
    const waitArg = mockCtx.waitUntil.mock.calls[0][0] as Promise<unknown>;
    // The writes are pending (or resolved) but were NOT awaited
    // synchronously by update().
    expect(waitArg).toBeInstanceOf(Promise);

    // Drain the background writes so the mock serviceFetch is called
    await waitArg;

    // Both D1 writes happened
    expect(d1Calls).toHaveLength(2);
    expect(d1Calls[0].query).toMatch(/INSERT INTO trades/);
    expect(d1Calls[1].query).toMatch(/REPLACE INTO positions/);
  });
