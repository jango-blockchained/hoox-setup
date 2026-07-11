// Source: packages/shared/src/analytics.ts (lines 45-79)
// Listing id: track-analytics
// Caption: Non-blocking analytics forwarding to analytics-worker
export async function trackAnalytics(
  env: AnalyticsEnv,
  endpoint: string,
  body: Record<string, unknown>,
  options?: TrackAnalyticsOptions
): Promise<void> {
  if (!env.ANALYTICS_SERVICE) return;
  try {
    const payload = {
      ...body,
      ...(options?.indexes ? { indexes: [...options.indexes] } : {}),
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // `INTERNAL_KEY_BINDING` is declared on Cloudflare's generated
    // `Env` type, not on `AnalyticsEnv` (to avoid duplicate-property
    // conflicts in workers whose `Env` extends both). Read it
    // dynamically; the property is always present at runtime in
    // production, and test mocks add it explicitly.
    const internalKey = (env as { INTERNAL_KEY_BINDING?: string })
      .INTERNAL_KEY_BINDING;
    if (internalKey) {
      headers["X-Internal-Auth-Key"] = internalKey;
    }
    await env.ANALYTICS_SERVICE.fetch(
      new Request(`http://localhost${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
    );
  } catch (e) {
    console.error("Analytics tracking failed:", e);
  }
