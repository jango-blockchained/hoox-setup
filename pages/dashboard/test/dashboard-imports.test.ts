import { describe, expect, test } from "bun:test";

describe("dashboard-worker imports", () => {
  test("middleware module exists", async () => {
    const mod = await import("../src/middleware");
    expect(mod).toBeDefined();
  });

  test("login route module exists", async () => {
    const mod = await import("../src/app/api/auth/login/route");
    expect(mod).toBeDefined();
    expect(mod).toHaveProperty("POST");
  });

  test("settings route module exists", async () => {
    const mod = await import("../src/app/api/settings/route");
    expect(mod).toBeDefined();
  });

  test("login route exports POST function", async () => {
    const { POST } = await import("../src/app/api/auth/login/route");
    expect(POST).toBeDefined();
    expect(typeof POST).toBe("function");
  });

  test("settings route exports GET function", async () => {
    const { GET } = await import("../src/app/api/settings/route");
    expect(GET).toBeDefined();
    expect(typeof GET).toBe("function");
  });

  test("settings route exports POST function", async () => {
    const { POST } = await import("../src/app/api/settings/route");
    expect(POST).toBeDefined();
    expect(typeof POST).toBe("function");
  });
});