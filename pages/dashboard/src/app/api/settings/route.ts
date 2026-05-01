import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ENV_KEYS, getConfig, validateRequiredEnv } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type Settings = Record<string, string | number | boolean | undefined>;
type AllSettings = Record<
  string,
  Record<string, string | number | boolean | undefined>
>;

const WORKER_PREFIX_MAP: Record<string, string> = {
  hoox: "global:",
  "trade-worker": "trade:",
  "agent-worker": "agent:",
  "telegram-worker": "bot:",
  "d1-worker": "database:",
  "email-worker": "email:",
  "web3-wallet-worker": "wallet:",
};

const SECTION_PREFIX_MAP: Record<string, string> = {
  global: "global:",
  webhook: "webhook:",
  routing: "routing:",
  security: "webhook:",
  trade: "trade:",
  agent: "agent:",
  bot: "bot:",
  email: "email:",
  database: "database:",
  retention: "retention:",
  cron: "cron:",
  behavior: "behavior:",
  exchanges: "trade:",
  fees: "trade:",
};

function getKVKey(worker: string, key: string): string {
  if (key.includes(":")) {
    const parts = key.split(":");
    const section = parts[0] || "";
    const field = parts[1] || "";
    const sectionPrefix = SECTION_PREFIX_MAP[section] || "";
    return `${sectionPrefix}${field}`;
  }
  const workerPrefix = WORKER_PREFIX_MAP[worker] || "";
  return `${workerPrefix}${key}`;
}

function findWorkerByPrefix(kvKey: string): string | null {
  const prefixToWorker: Record<string, string> = {
    "global:": "hoox",
    "webhook:": "hoox",
    "routing:": "hoox",
    "trade:": "trade-worker",
    "agent:": "agent-worker",
    "bot:": "telegram-worker",
    "email:": "email-worker",
    "database:": "d1-worker",
    "retention:": "d1-worker",
    "cron:": "agent-worker",
    "behavior:": "agent-worker",
    "wallet:": "web3-wallet-worker",
  };

  for (const [prefix, worker] of Object.entries(prefixToWorker)) {
    if (kvKey.startsWith(prefix)) return worker;
  }
  return null;
}

function stripWorkerPrefix(kvKey: string, worker: string): string {
  const prefix = WORKER_PREFIX_MAP[worker] || "";
  if (prefix && kvKey.startsWith(prefix)) {
    return kvKey.substring(prefix.length);
  }
  return kvKey;
}

export async function GET(
  request: NextRequest,
  _context: { params: Promise<{}> }
) {
  try {
    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      const settings: Record<string, any> = {};
      const prefixes = [
        "global:",
        "webhook:",
        "trade:",
        "agent:",
        "bot:",
        "email:",
        "database:",
        "retention:",
        "routing:",
        "behavior:",
        "cron:",
        "ai:",
      ];

      for (const prefix of prefixes) {
        const list = await env.CONFIG_KV.list({ prefix });
        for (const kv of list.keys) {
          const value = await env.CONFIG_KV.get(kv.name);
          if (value !== null) {
            try {
              settings[kv.name] = JSON.parse(value);
            } catch {
              settings[kv.name] = value;
            }
          }
        }
      }

      const normalized: AllSettings = {};

      for (const [key, value] of Object.entries(settings)) {
        const worker = findWorkerByPrefix(key);
        if (worker) {
          const cleanKey = stripWorkerPrefix(key, worker);
          if (!normalized[worker]) normalized[worker] = {};
          normalized[worker][cleanKey] = value;
        }
      }

      return NextResponse.json({ settings: normalized });
    } else {
      // Fallback to D1 worker if KV binding isn't available
      const configErrors = validateRequiredEnv([ENV_KEYS.internalAuth.d1]);
      if (configErrors.length > 0) {
        return NextResponse.json({ error: "Configuration error", missing: configErrors }, { status: 500 });
      }

      const res = await fetch(`${getConfig().api.d1Service}/api/settings`, {
        headers: { "X-Internal-Auth-Key": getConfig().internalAuth.d1 || "" },
      });

      if (res.ok) {
        const data = (await res.json()) as { settings?: AllSettings };
        const settings = (data.settings || {}) as unknown as Record<
          string,
          string | number | boolean
        >;
        const normalized: Record<string, any> = {};

        for (const [key, value] of Object.entries(settings)) {
          const worker = findWorkerByPrefix(key);
          if (worker) {
            const cleanKey = stripWorkerPrefix(key, worker);
            if (!normalized[worker]) normalized[worker] = {};
            (normalized[worker] as Record<string, string | number | boolean>)[
              cleanKey
            ] = value as string | number | boolean;
          }
        }

        return NextResponse.json({ settings: normalized } as any);
      }
    }
  } catch (e) {
    console.error("Failed to fetch settings:", e);
  }

  return NextResponse.json({ settings: {} });
}

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{}> }
) {
  try {
    const body = (await request.json()) as {
      worker?: string;
      key?: string;
      value?: string | number | boolean;
    };
    const { worker, key, value } = body;

    if (!worker || !key) {
      return NextResponse.json(
        { error: "Missing worker or key" },
        { status: 400 }
      );
    }

    const kvKey = getKVKey(worker, key);
    const env = getCloudflareContext().env as unknown as {
      CONFIG_KV?: KVNamespace;
    };

    if (env?.CONFIG_KV) {
      await env.CONFIG_KV.put(kvKey, JSON.stringify(value));
      return NextResponse.json({ success: true, worker, key, value, kvKey });
    } else {
      // Fallback to D1 worker
      const configErrors = validateRequiredEnv([ENV_KEYS.internalAuth.d1]);
      if (configErrors.length > 0) {
        return NextResponse.json({ error: "Configuration error", missing: configErrors }, { status: 500 });
      }

      const res = await fetch(`${getConfig().api.d1Service}/api/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Auth-Key": getConfig().internalAuth.d1 || "",
        },
        body: JSON.stringify({ worker, key: kvKey, value }),
      });

      if (!res.ok) {
        const error = (await res.json()) as { error?: string };
        return NextResponse.json({ error }, { status: res.status });
      }

      return NextResponse.json({ success: true, worker, key, value, kvKey });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
