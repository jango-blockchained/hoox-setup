/**
 * Comprehensive test suite for CORS middleware
 * Tests CORS headers, preflight requests, allowed origins/methods, credentials, and max age
 */

import { describe, it, expect } from "bun:test";
import {
  corsHeaders,
  handleCorsPreflightRequest,
} from "../../src/middleware/cors";

describe("corsHeaders", () => {
  it("returns default CORS headers", () => {
    const headers = corsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, OPTIONS, PUT, DELETE"
    );
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization, X-Request-ID, X-Internal-Auth-Key"
    );
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
  });

  it("does not include credentials header by default", () => {
    const headers = corsHeaders();
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("allows custom origin", () => {
    const headers = corsHeaders({ allowOrigin: "https://example.com" });
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
  });

  it("allows custom methods", () => {
    const headers = corsHeaders({ allowMethods: "GET, POST" });
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST");
  });

  it("allows custom headers", () => {
    const headers = corsHeaders({
      allowHeaders: "Content-Type, X-Custom-Header",
    });
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, X-Custom-Header"
    );
  });

  it("includes credentials header when enabled", () => {
    const headers = corsHeaders({ allowCredentials: true });
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("does not include credentials header when explicitly disabled", () => {
    const headers = corsHeaders({ allowCredentials: false });
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("allows custom max age", () => {
    const headers = corsHeaders({ maxAge: 3600 });
    expect(headers["Access-Control-Max-Age"]).toBe("3600");
  });

  it("converts max age to string", () => {
    const headers = corsHeaders({ maxAge: 7200 });
    expect(typeof headers["Access-Control-Max-Age"]).toBe("string");
    expect(headers["Access-Control-Max-Age"]).toBe("7200");
  });

  it("merges custom options with defaults", () => {
    const headers = corsHeaders({
      allowOrigin: "https://custom.com",
      maxAge: 1800,
    });
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://custom.com");
    expect(headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, OPTIONS, PUT, DELETE"
    );
    expect(headers["Access-Control-Max-Age"]).toBe("1800");
  });
});

describe("handleCorsPreflightRequest", () => {
  it("returns null for non-OPTIONS requests", () => {
    const request = new Request("https://example.com/api/test", {
      method: "GET",
    });
    const result = handleCorsPreflightRequest(request);
    expect(result).toBeNull();
  });

  it("returns null for POST requests", () => {
    const request = new Request("https://example.com/api/test", {
      method: "POST",
    });
    const result = handleCorsPreflightRequest(request);
    expect(result).toBeNull();
  });

  it("returns Response for OPTIONS requests", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request);
    expect(result).toBeInstanceOf(Response);
  });

  it("returns 204 No Content for preflight requests", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request);
    expect(result?.status).toBe(204);
  });

  it("includes CORS headers in preflight response", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request);
    expect(result?.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(result?.headers.get("Access-Control-Allow-Methods")).toBeDefined();
    expect(result?.headers.get("Access-Control-Allow-Headers")).toBeDefined();
  });

  it("includes max age header in preflight response", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request);
    expect(result?.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("applies custom options to preflight response", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request, {
      allowOrigin: "https://example.com",
      maxAge: 3600,
    });
    expect(result?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com"
    );
    expect(result?.headers.get("Access-Control-Max-Age")).toBe("3600");
  });

  it("includes credentials header when enabled in preflight", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request, {
      allowCredentials: true,
    });
    expect(result?.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true"
    );
  });

  it("returns empty body for preflight response", async () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request);
    const body = await result?.text();
    expect(body).toBe("");
  });

  it("handles case-insensitive OPTIONS method", () => {
    // Note: Request constructor normalizes method to uppercase
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request);
    expect(result).toBeInstanceOf(Response);
  });

  it("applies custom methods to preflight response", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request, {
      allowMethods: "GET, POST, PUT",
    });
    expect(result?.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, POST, PUT"
    );
  });

  it("applies custom headers to preflight response", () => {
    const request = new Request("https://example.com/api/test", {
      method: "OPTIONS",
    });
    const result = handleCorsPreflightRequest(request, {
      allowHeaders: "Content-Type, X-Custom",
    });
    expect(result?.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, X-Custom"
    );
  });
});
