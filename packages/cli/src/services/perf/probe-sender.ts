/**
 * Sends a single fast-path probe to the deployed hoox gateway.
 * Returns a structured result with status, total_ms, and http_status.
 *
 * The probe is a regular HTTP POST with `probe: true` in the body.
 * Workers downstream short-circuit before any real exchange call.
 */

export interface ProbeRequest {
  probe: true;
  probe_id: string;
  symbol: string;
  action: "LONG" | "SHORT";
  quantity: number;
  timestamp: number;
}

export interface ProbeSenderOptions {
  url: string;
  apiKey: string;
  timeoutMs: number;
}

export type ProbeResultStatus = "ok" | "timeout" | "error" | "auth_failed";

export interface ProbeResult {
  probe_id: string;
  status: ProbeResultStatus;
  total_ms: number | null;
  http_status: number | null;
  error?: string;
}

export async function sendProbe(
  req: ProbeRequest,
  options: ProbeSenderOptions
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), options.timeoutMs);

  const t0 = Date.now();
  try {
    const request = new Request(options.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Key": options.apiKey,
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    const response = await fetch(request);
    const total_ms = Date.now() - t0;
    const http_status = response.status;

    if (http_status === 401 || http_status === 403) {
      return {
        probe_id: req.probe_id,
        status: "auth_failed",
        total_ms,
        http_status,
      };
    }
    if (http_status >= 500) {
      return { probe_id: req.probe_id, status: "error", total_ms, http_status };
    }
    if (!response.ok) {
      return {
        probe_id: req.probe_id,
        status: "error",
        total_ms,
        http_status,
        error: `HTTP ${http_status}`,
      };
    }
    return { probe_id: req.probe_id, status: "ok", total_ms, http_status };
  } catch (err) {
    const total_ms = Date.now() - t0;
    if (
      err instanceof Error &&
      (err.name === "AbortError" || controller.signal.aborted)
    ) {
      return {
        probe_id: req.probe_id,
        status: "timeout",
        total_ms,
        http_status: null,
      };
    }
    return {
      probe_id: req.probe_id,
      status: "error",
      total_ms,
      http_status: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
