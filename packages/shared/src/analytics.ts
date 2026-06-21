/**
 * Analytics tracking utilities for Cloudflare Workers
 * Centralizes the trackAnalytics helper used across all workers
 */

/**
 * Environment with optional analytics service binding.
 * Workers that support analytics tracking should extend this type.
 */
export interface AnalyticsEnv {
  ANALYTICS_SERVICE?: Fetcher;
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
    await env.ANALYTICS_SERVICE.fetch(
      new Request(`http://localhost${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
  } catch (e) {
    console.error("Analytics tracking failed:", e);
  }
}
