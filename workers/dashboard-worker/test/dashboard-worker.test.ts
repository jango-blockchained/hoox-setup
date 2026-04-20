import { describe, expect, test, beforeEach, jest } from "bun:test";

const mockEnv = {
  D1_SERVICE: {
    fetch: jest.fn()
  },
  TRADE_SERVICE: {
    fetch: jest.fn()
  },
  CONFIG_KV: {
    get: jest.fn(),
    put: jest.fn()
  },
  DASHBOARD_USER: "admin",
  DASHBOARD_PASS: "hoox123"
};

describe("dashboard-worker", () => {
  beforeEach(() => {
    mockEnv.D1_SERVICE.fetch.mockReset();
    mockEnv.TRADE_SERVICE.fetch.mockReset();
    mockEnv.CONFIG_KV.get.mockReset();
    mockEnv.CONFIG_KV.put.mockReset();
  });

  test("GET / returns overview page", async () => {
    mockEnv.CONFIG_KV.get.mockResolvedValue("AI is healthy");
    mockEnv.D1_SERVICE.fetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, stats: { totalTrades: 10, openPositions: 2 }, recentActivity: [] }), { status: 200 })
    );

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Overview");
  });

  test("GET /positions returns positions page", async () => {
    mockEnv.TRADE_SERVICE.fetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, positions: [] }), { status: 200 })
    );

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/positions", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Positions");
  });

  test("GET /logs returns logs page", async () => {
    mockEnv.D1_SERVICE.fetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, logs: [] }), { status: 200 })
    );

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/logs", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Logs");
  });

  test("GET /settings returns settings page", async () => {
    mockEnv.CONFIG_KV.get.mockResolvedValue(null);

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/settings", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Settings");
  });

  test("returns 401 without auth", async () => {
    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/");
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(401);
  });

  test("returns 401 with wrong credentials", async () => {
    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/", {
      headers: { "Authorization": "Basic " + btoa("wrong:credentials") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(401);
  });

  test("POST /settings updates settings", async () => {
    mockEnv.CONFIG_KV.get.mockResolvedValue(null);
    mockEnv.CONFIG_KV.put.mockResolvedValue();

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/settings", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa("admin:hoox123"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "kill_switch=true&max_drawdown=10"
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect([200, 302, 303]).toContain(res.status);
  });

  test("shows error when D1 service unavailable", async () => {
    mockEnv.D1_SERVICE.fetch.mockRejectedValue(new Error("Connection failed"));
    mockEnv.CONFIG_KV.get.mockResolvedValue("AI healthy");

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Error");
  });

  test("shows AI health summary from KV", async () => {
    mockEnv.CONFIG_KV.get.mockResolvedValue("AI is operating normally with 98% confidence");
    mockEnv.D1_SERVICE.fetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, stats: { totalTrades: 0, openPositions: 0 }, recentActivity: [] }), { status: 200 })
    );

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    const html = await res.text();
    
    expect(html).toContain("AI is operating normally");
  });

  test("GET /positions with position close action", async () => {
    mockEnv.TRADE_SERVICE.fetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, positions: [{ id: "1", symbol: "BTCUSDT" }] }), { status: 200 })
    );

    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/positions", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(200);
  });

  test("returns 404 for unknown route", async () => {
    const { default: app } = await import("../src/index.tsx");
    const req = new Request("http://localhost/unknown-route-xyz", {
      headers: { "Authorization": "Basic " + btoa("admin:hoox123") }
    });
    const res = await app.fetch(req, mockEnv as any);
    
    expect(res.status).toBe(404);
  });
});