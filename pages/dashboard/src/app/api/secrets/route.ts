import { NextResponse } from "next/server";
import { ENV_KEYS, getEnvVar } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const ALL_SECRETS = [
  "AGENT_INTERNAL_KEY",
  "D1_INTERNAL_KEY",
  "API_SERVICE_KEY",
  "TELEGRAM_INTERNAL_KEY",
  "WEBHOOK_API_KEY_BINDING",
  "BINANCE_API_KEY",
  "BINANCE_API_SECRET",
  "MEXC_API_KEY",
  "MEXC_API_SECRET",
  "BYBIT_API_KEY",
  "BYBIT_SECRET_BINDING",
  "TELEGRAM_BOT_TOKEN",
  "EMAIL_USER",
  "EMAIL_PASS",
];

const INTERNAL_KEY_SECRETS = [
  "AGENT_INTERNAL_KEY",
  "D1_INTERNAL_KEY",
  "API_SERVICE_KEY",
  "TELEGRAM_INTERNAL_KEY",
];

async function getCloudflareAccountId(): Promise<string | null> {
  return getEnvVar(ENV_KEYS.cloudflare.accountId) || "debc6545e63bea36be059cbc82d80ec8";
}

async function getCloudflareApiToken(): Promise<string | null> {
  return getEnvVar(ENV_KEYS.cloudflare.apiToken) || null;
}

async function getCloudflareSecretStoreId(): Promise<string | null> {
  return getEnvVar(ENV_KEYS.cloudflare.secretStoreId) || "48433bc559a943f09d9d6c622e188fd5";
}

export async function GET() {
  try {
    const accountId = await getCloudflareAccountId();
    const apiToken = await getCloudflareApiToken();
    const storeId = await getCloudflareSecretStoreId();

    let fetchedSecrets: { name: string }[] = [];

    if (apiToken && accountId && storeId) {
      // Fetch from Cloudflare Secret Store directly instead of reading process.env
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/secrets_store/stores/${storeId}/secrets`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json() as { success: boolean; result?: { name: string }[] };
      if (data.success && data.result) {
        fetchedSecrets = data.result;
      }
    } else {
      // Fallback to process.env if CF tokens are not set
      fetchedSecrets = ALL_SECRETS.filter(name => !!getEnvVar(name)).map(name => ({ name }));
    }

    const availableNames = new Set(fetchedSecrets.map(s => s.name));

    const syncedSecrets = ALL_SECRETS.map(name => ({
      name,
      synced: availableNames.has(name) || !!getEnvVar(name),
    }));

    return NextResponse.json({
      success: true,
      secrets: syncedSecrets,
      internalKeys: INTERNAL_KEY_SECRETS.map(name => ({
        name,
        synced: availableNames.has(name) || !!getEnvVar(name),
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string };
    const { action } = body;

    // We no longer sync to pages secrets for trading keys, the CLI manage.ts directly updates the Secret Store.
    if (action === "sync-to-pages" || action === "sync-all-internal-keys") {
      return NextResponse.json({
        success: true,
        message: "Secrets should be updated via the CLI (bun run scripts/manage.ts secrets update-cf) or Cloudflare Dashboard. The UI check relies on the Cloudflare Secret Store API.",
        command: `bun run scripts/manage.ts secrets update-cf <secretName> <workerName>`,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
