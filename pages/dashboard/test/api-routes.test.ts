import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";

// Mock modules before imports
mock.module("server-only", () => {
  return {};
});

// Store original env
const originalEnv = { ...process.env };

// Mocks
let mockKV: any = {};

// Define mock function - use let so it can be reassigned in tests
let mockGetRequestContext = () => {
  return {
    env: {
      CONFIG_KV: {
        list: async ({ prefix }: { prefix: string }) => {
          const keys = Object.keys(mockKV)
            .filter((k) => k.startsWith(prefix))
            .map((k) => ({ name: k }));
          return { keys };
        },
        get: async (key: string) => {
          return mockKV[key] || null;
        },
        put: async (key: string, value: string) => {
          mockKV[key] = value;
        },
      },
    },
  };
};

// Setup mocks
mock.module("@opennextjs/cloudflare", () => {
  return {
    getCloudflareContext: mockGetRequestContext,
  };
});

// Import after mocks
let loginRoute: any;
let settingsRoute: any;
let proxyModule: any;

describe("Login API Route", () => {
  beforeEach(async () => {
    mockKV = {};
    process.env = { ...originalEnv };
    loginRoute = await import("../src/app/api/auth/login/route");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("POST returns 401 when DASHBOARD_USER not set", async () => {
    delete process.env.DASHBOARD_USER;
    delete process.env.DASHBOARD_PASS;

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "pass" }),
    });

    const response = await loginRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Auth not configured");
  });

  test("POST returns 401 with invalid credentials", async () => {
    process.env.DASHBOARD_USER = "admin";
    process.env.DASHBOARD_PASS = "password123";

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wrong", password: "wrong" }),
    });

    const response = await loginRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid credentials");
  });

  test("POST returns success with valid credentials", async () => {
    process.env.DASHBOARD_USER = "admin";
    process.env.DASHBOARD_PASS = "password123";

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "password123" }),
    });

    const response = await loginRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(response.cookies.get("session")?.value).toBe("admin");
  });

  test("POST returns 400 with invalid JSON", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await loginRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid request");
  });

  test("DELETE clears session cookie", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "DELETE",
    });

    const response = await loginRoute.DELETE(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(response.cookies.get("session")?.value).toBe("");
  });
});

describe("Settings API Route", () => {
  beforeEach(async () => {
    mockKV = {};
    process.env = { ...originalEnv };
    settingsRoute = await import("../src/app/api/settings/route");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("GET returns settings from KV", async () => {
    mockKV["global:setting1"] = JSON.stringify("value1");
    mockKV["trade:setting2"] = JSON.stringify(123);

    const response = await settingsRoute.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toBeDefined();
    expect(body.settings["hoox"]).toBeDefined();
    expect(body.settings["trade-worker"]).toBeDefined();
  });

  test("GET handles KV JSON parse", async () => {
    mockKV["global:test"] = "plain-string-value";

    const response = await settingsRoute.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings["hoox"]["test"]).toBe("plain-string-value");
  });

  test("GET falls back to D1 worker when KV not available", async () => {
    // Override getRequestContext to return no KV
    mockGetRequestContext = () => ({ env: {} });

    const originalFetch = global.fetch;
    global.fetch = mock(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ settings: { "hoox": { "test": "value" } } }),
      } as any)
    );

    process.env.D1_WORKER_URL = "http://d1-worker";
    process.env.D1_INTERNAL_KEY = "internal-key";

    const response = await settingsRoute.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toBeDefined();

    global.fetch = originalFetch;
  });

  test("GET returns empty settings on error", async () => {
    mockGetRequestContext = () => { throw new Error("KV error"); };

    const response = await settingsRoute.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({});
  });

  test("POST saves setting to KV", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker: "hoox", key: "testKey", value: "testValue" }),
    });

    const response = await settingsRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.kvKey).toBe("global:testKey");
  });

  test("POST with section:key format", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker: "hoox", key: "webhook:url", value: "http://test" }),
    });

    const response = await settingsRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kvKey).toBe("webhook:url");
  });

  test("POST returns 400 when missing worker or key", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker: "", key: "" }),
    });

    const response = await settingsRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing worker or key");
  });

  test("POST falls back to D1 worker when KV not available", async () => {
    mockGetRequestContext = () => ({ env: {} });

    const originalFetch = global.fetch;
    global.fetch = mock(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as any)
    );

    process.env.D1_WORKER_URL = "http://d1-worker";
    process.env.D1_INTERNAL_KEY = "internal-key";

    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker: "hoox", key: "test", value: "val" }),
    });

    const response = await settingsRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    global.fetch = originalFetch;
  });

  test("POST returns 400 with invalid JSON", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await settingsRoute.POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

describe("Middleware", () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    proxyModule = await import("../src/proxy");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("allows access to /login path", () => {
    const request = new Request("http://localhost/login");
    const response = proxyModule.proxy({ nextUrl: { pathname: "/login" }, cookies: { get: () => null } } as any);

    expect(response).toBeDefined();
  });

  test("allows access to /api/auth paths", () => {
    const request = new Request("http://localhost/api/auth/login");
    const response = proxyModule.proxy({ nextUrl: { pathname: "/api/auth/login" }, cookies: { get: () => null } } as any);

    expect(response).toBeDefined();
  });

  test("redirects to /login when no session", () => {
    process.env.DASHBOARD_USER = "admin";

    const request = {
      nextUrl: { pathname: "/dashboard" },
      cookies: { get: () => null },
      url: "http://localhost/dashboard",
    } as any;

    const response = proxyModule.proxy(request);
    const location = response.headers.get("location");

    expect(location).toBeTruthy();
    expect(location).toContain("/login");
  });

  test("returns 401 for API paths without session", () => {
    process.env.DASHBOARD_USER = "admin";

    const response = proxyModule.proxy({
      nextUrl: { pathname: "/api/settings" },
      cookies: { get: () => null },
    } as any);

    expect(response?.status).toBe(401);
  });

  test("allows access with valid session", () => {
    process.env.DASHBOARD_USER = "admin";

    const response = proxyModule.proxy({
      nextUrl: { pathname: "/dashboard" },
      cookies: { get: () => ({ value: "admin" }) },
    } as any);

    expect(response?.status).not.toBe(401);
  });

  test("allows access when AUTH_TYPE is none", () => {
    process.env.AUTH_TYPE = "none";

    const response = proxyModule.proxy({
      nextUrl: { pathname: "/dashboard" },
      cookies: { get: () => null },
    } as any);

    expect(response?.status).not.toBe(401);
  });

  test("handles errors gracefully", () => {
    // Force an error by removing DASHBOARD_USER after error check starts
    const response = proxyModule.proxy({
      nextUrl: { pathname: "/dashboard" },
      cookies: { get: () => { throw new Error("Cookie error"); } },
    } as any);

    expect(response).toBeDefined();
  });
});

describe("Settings Helper Functions", () => {
  beforeEach(async () => {
    settingsRoute = await import("../src/app/api/settings/route");
  });

  test("getKVKey adds worker prefix", () => {
    // Test via POST which uses getKVKey
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker: "hoox", key: "test", value: "val" }),
    });

    return settingsRoute.POST(request as any).then((response: any) => response.json()).then((body: any) => {
      expect(body.kvKey).toBe("global:test");
    });
  });

  test("findWorkerByPrefix identifies worker", () => {
    // Test via GET which uses findWorkerByPrefix
    mockKV["trade:test"] = JSON.stringify("value");

    return settingsRoute.GET().then((response: any) => response.json()).then((body: any) => {
      expect(body.settings["trade-worker"]).toBeDefined();
    });
  });
});
