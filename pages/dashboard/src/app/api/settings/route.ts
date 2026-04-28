import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type Settings = Record<string, string | number | boolean>;
type AllSettings = Record<string, Settings>;

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
    const [section, field] = key.split(":");
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

export async function GET() {
  try {
    const env = getRequestContext().env as unknown as { CONFIG_KV?: KVNamespace };
    
    if (env?.CONFIG_KV) {
      const settings: Record<string, any> = {};
      const prefixes = [
        "global:", "webhook:", "trade:", "agent:", "bot:",
        "email:", "database:", "retention:", "routing:", "behavior:", "cron:", "ai:"
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
      const res = await fetch(`${process.env.D1_WORKER_URL}/api/settings`, {
        headers: { "X-Internal-Auth-Key": process.env.D1_INTERNAL_KEY || "" },
      });

      if (res.ok) {
        const data = (await res.json()) as { settings?: AllSettings };
        const settings = data.settings || {};
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
      }
    }
  } catch (e) {
    console.error("Failed to fetch settings:", e);
  }

  return NextResponse.json({ settings: {} });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { worker?: string; key?: string; value?: string | number | boolean };
    const { worker, key, value } = body;

    if (!worker || !key) {
      return NextResponse.json({ error: "Missing worker or key" }, { status: 400 });
    }

    const kvKey = getKVKey(worker, key);
    const env = getRequestContext().env as unknown as { CONFIG_KV?: KVNamespace };

    if (env?.CONFIG_KV) {
      await env.CONFIG_KV.put(kvKey, JSON.stringify(value));
      return NextResponse.json({ success: true, worker, key, value, kvKey });
    } else {
      // Fallback to D1 worker
      const res = await fetch(`${process.env.D1_WORKER_URL}/api/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Auth-Key": process.env.D1_INTERNAL_KEY || "",
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
