// Source: tests/security/auth-bypass.test.ts (lines 17-58)
// Listing id: test-auth-fail-closed
// Caption: Security test: requireInternalAuth fail-closed behavior
describe("requireInternalAuth - fail-closed", () => {
  it("rejects with 401 when INTERNAL_KEY_BINDING is not configured", () => {
    const env = {} as Record<string, unknown>;
    const request = new Request("http://localhost/test");

    const result = requireInternalAuth(request, env);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("rejects with 401 when INTERNAL_KEY_BINDING is undefined", () => {
    const env = { INTERNAL_KEY_BINDING: undefined };
    const request = new Request("http://localhost/test");

    const result = requireInternalAuth(request, env);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("rejects with 401 when key is configured but header is missing", () => {
    const env = { INTERNAL_KEY_BINDING: "secret-123" };
    const request = new Request("http://localhost/test");

    const result = requireInternalAuth(request, env);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("rejects with 401 when key is configured but header has wrong value", () => {
    const env = { INTERNAL_KEY_BINDING: "secret-123" };
    const request = new Request("http://localhost/test", {
      headers: { "X-Internal-Auth-Key": "wrong-key" },
    });

    const result = requireInternalAuth(request, env);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
