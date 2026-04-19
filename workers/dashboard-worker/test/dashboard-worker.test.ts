import { expect, test, describe } from "bun:test";
import app from "../src/index";

describe("Dashboard Worker", () => {
  test("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/");
    const res = await app.fetch(req, {
      D1_SERVICE: {} as any
    });
    
    expect(res.status).toBe(401);
  });

  test("returns 200 and renders HTML when authenticated", async () => {
    const req = new Request("http://localhost/");
    // Basic auth header for admin:hoox123
    req.headers.set("Authorization", "Basic " + btoa("admin:hoox123"));
    
    const res = await app.fetch(req, {
      D1_SERVICE: {} as any
    });
    
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Workers &amp; Pages");
  });
});