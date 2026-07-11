// Source: tests/integration/fastpath.test.ts (lines 67-113)
// Listing id: test-fastpath-probe
// Caption: Integration test: probe short-circuit leaves D1 trades unchanged
  it("sends a probe and gets a 200 response with status: probed", async () => {
    if (!reachable) {
      console.warn("Skipping: workers not reachable at", GATEWAY_URL);
      return;
    }
    const probe_id = crypto.randomUUID();
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": INTERNAL_KEY,
      },
      body: JSON.stringify({
        probe: true,
        probe_id,
        symbol: "BTCUSDT",
        action: "LONG",
        quantity: 0.001,
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.probe_id).toBe(probe_id);
    expect(body.status).toBe("probed");
  });

  it("does NOT add a row to the trades table", async () => {
    if (!reachable || tradesBefore < 0) return;
    const probe_id = crypto.randomUUID();
    await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": INTERNAL_KEY,
      },
      body: JSON.stringify({
        probe: true,
        probe_id,
        symbol: "BTCUSDT",
        action: "LONG",
        quantity: 0.001,
      }),
    });
    await new Promise((r) => setTimeout(r, 500));
    const tradesAfter = await queryTradesCount();
    expect(tradesAfter).toBe(tradesBefore);
  });
