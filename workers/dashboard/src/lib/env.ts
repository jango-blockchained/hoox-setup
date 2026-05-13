import type { KVNamespace } from "@cloudflare/workers-types";

export interface DashboardEnv {
  CONFIG_KV: KVNamespace;
  D1_SERVICE: Fetcher;
  AGENT_SERVICE: Fetcher;
}
