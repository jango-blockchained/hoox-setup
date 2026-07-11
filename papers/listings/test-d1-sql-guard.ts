// Source: workers/d1-worker/test/d1-worker.test.ts (lines 369-387)
// Listing id: test-d1-sql-guard
// Caption: Unit test: unauthorized table returns HTTP 403
  test("rejects queries referencing unauthorized tables", async () => {
    const request = new Request("https://d1-worker.workers.dev/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": TEST_INTERNAL_KEY,
      },
      body: JSON.stringify({ query: "SELECT * FROM secret_table", params: [] }),
    });
    const response = await d1Worker.fetch(
      request as any,
      mockEnv as any,
      createMockCtx() as any
    );
    expect(response.status).toBe(403);
    const data = (await response.json()) as any;
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unauthorized table");
  });
