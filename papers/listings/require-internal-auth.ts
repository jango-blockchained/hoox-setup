// Source: packages/shared/src/middleware/auth.ts (lines 78-102)
// Listing id: require-internal-auth
// Caption: Internal service-to-service authentication (fail-closed)
export function requireInternalAuth(
  request: Request,
  env: InternalAuthEnv,
  keyName: string = "INTERNAL_KEY_BINDING"
): Response | null {
  const expectedKey = env[keyName] as string | undefined;
  // Fail closed: if no key is configured, reject the request
  if (!expectedKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Internal auth key ${keyName} not configured`,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const providedKey = request.headers.get("X-Internal-Auth-Key");
  if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
