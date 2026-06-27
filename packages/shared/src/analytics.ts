/**
 * Analytics tracking utilities for Cloudflare Workers
 * Centralizes the trackAnalytics helper used across all workers
 */

/**
 * Environment with optional analytics service binding.
 * Workers that support analytics tracking should extend this type.
 *
 * `INTERNAL_KEY_BINDING` is required for authenticated delivery to the
 * analytics worker (its `/track/*` routes are gated by
 * `requireInternalAuth`). When the binding is absent the helper falls
 * back to an unauthenticated request; the analytics worker will 401 it,
 * preserving the old fail-loud behaviour until operators configure the
 * secret.
 */
export interface AnalyticsEnv {
  ANALYTICS_SERVICE?: Fetcher;
  INTERNAL_KEY_BINDING?: string;
}

/**
 * Optional configuration for trackAnalytics.
 */
export interface TrackAnalyticsOptions {
  /**
   * Custom indexes to attach to the Analytics Engine data point.
   * Use this to tag rows with stable identifiers (e.g. probe_id)
   * so they can be SQL-queried later.
   */
  indexes?: readonly string[];
}

/**
 * Track an analytics event by forwarding to the analytics worker.
 * Non-blocking: failures are logged but never throw.
 *
 * @param env - Worker environment with optional ANALYTICS_SERVICE binding
 * @param endpoint - Analytics endpoint path (e.g., "/track/api-call")
 * @param body - JSON-serializable payload to send
 * @param options - Optional config (currently supports `indexes`)
 */
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
    if (env.INTERNAL_KEY_BINDING) {
      headers["X-Internal-Auth-Key"] = env.INTERNAL_KEY_BINDING;
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
}
