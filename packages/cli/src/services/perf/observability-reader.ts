/**
 * Reads per-hop probe timings from Cloudflare Workers Observability.
 * Filters events by probe_id (in $metadata.message JSON payload) and groups
 * by $metadata.service to produce per-worker latency samples.
 */

import { TraceService } from "../../commands/trace/trace-service.js";
import type {
  TraceQueryRequest,
  TraceQueryResponse,
} from "../../commands/trace/types.js";

export interface ReadProbeOptions {
  probeIds: readonly string[];
  from: number;
  to: number;
}

export interface HopSamples {
  service: string;
  samples: number[];
  count: number;
}

export interface ReadProbeResult {
  hops: HopSamples[];
  degraded: boolean;
}

interface LogPayload {
  probe_id?: string;
  hop?: string;
  duration_ms?: number;
}

export interface ObservabilityReaderDeps {
  query: (request: TraceQueryRequest) => Promise<TraceQueryResponse>;
}

export class ObservabilityReader {
  private deps: ObservabilityReaderDeps;

  constructor(deps?: Partial<ObservabilityReaderDeps>) {
    if (deps?.query) {
      this.deps = { query: deps.query };
    } else {
      const traceService = new TraceService();
      this.deps = {
        query: (req) => traceService.query(req),
      };
    }
  }

  async readProbeEvents(options: ReadProbeOptions): Promise<ReadProbeResult> {
    const services = ["hoox", "trade-worker", "analytics-worker"] as const;
    const allEvents: Array<{
      service: string;
      timestamp: number;
      message: string;
    }> = [];

    for (const service of services) {
      const response = await this.deps.query({
        view: "events",
        queryId: "trace-events",
        limit: 1000,
        parameters: {
          filters: [
            {
              key: "$metadata.service",
              operation: "eq",
              type: "string",
              value: service,
            },
          ],
        },
        timeframe: { from: options.from, to: options.to },
      });
      for (const ev of response.events ?? []) {
        const md = ev.$metadata;
        if (!md?.service || !md?.message) continue;
        allEvents.push({
          service: md.service,
          timestamp:
            typeof md.timestamp === "string" ? Date.parse(md.timestamp) : 0,
          message: md.message,
        });
      }
    }

    const probeIdSet = new Set(options.probeIds);
    const byService = new Map<string, number[]>();
    for (const ev of allEvents) {
      let payload: LogPayload;
      try {
        payload = JSON.parse(ev.message) as LogPayload;
      } catch {
        continue;
      }
      if (!payload.probe_id || !probeIdSet.has(payload.probe_id)) continue;
      if (typeof payload.duration_ms !== "number") continue;
      const arr = byService.get(ev.service) ?? [];
      arr.push(payload.duration_ms);
      byService.set(ev.service, arr);
    }

    const hops: HopSamples[] = [];
    for (const [service, samples] of byService.entries()) {
      hops.push({ service, samples, count: samples.length });
    }

    const degraded = hops.length === 0;
    return { hops, degraded };
  }
}
