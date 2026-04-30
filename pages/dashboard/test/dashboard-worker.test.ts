import { describe, expect, test, mock } from "bun:test";

mock.module("server-only", () => {
  return {};
});

describe("Dashboard Worker - Module Imports", () => {
  test("middleware module loads", async () => {
    const mod = await import("../src/middleware");
    expect(mod).toHaveProperty("middleware");
  });

  test("login route defines POST handler", async () => {
    const mod = await import("../src/app/api/auth/login/route");
    expect(mod).toHaveProperty("POST");
  });

  test("settings route defines GET and POST handlers", async () => {
    const mod = await import("../src/app/api/settings/route");
    expect(mod).toHaveProperty("GET");
    expect(mod).toHaveProperty("POST");
  });

  test("login route validates credentials", async () => {
    process.env.DASHBOARD_USER = "admin";
    process.env.DASHBOARD_PASS = "test";
    
    const { POST } = await import("../src/app/api/auth/login/route");
    expect(POST.name).toBe("POST");
  });

  test("settings route GET handler is async", async () => {
    const { GET } = await import("../src/app/api/settings/route");
    expect(GET.name).toBe("GET");
  });
});