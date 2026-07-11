// Source: workers/trade-worker/src/index.ts (lines 369-400)
// Listing id: probe-short-circuit
// Caption: trade-worker probe short-circuit for synthetic latency measurement
    // Probe short-circuit: check raw payload before validation (probe is a control signal, not a trade)
    if ((payload as Record<string, unknown>).probe === true) {
      const tHopStart = performance.now();
      const probeId = String(
        (payload as Record<string, unknown>).probe_id ?? ""
      );
      ctx.waitUntil(
        trackAnalytics(
          env,
          "/track/api-call",
          {
            worker: "trade-worker",
            endpoint: "/webhook",
            latencyMs: 0,
            success: true,
          },
          { indexes: [probeId] }
        )
      );
      const twHopMs = performance.now() - tHopStart;
      console.log(
        JSON.stringify({
          probe_id: probeId,
          hop: "trade-worker",
          duration_ms: Math.round(twHopMs),
        })
      );
      return new Response(
        JSON.stringify({ ok: true, probe_id: probeId, status: "probed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
