import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const INTERNAL_KEY_SECRETS = [
  "AGENT_INTERNAL_KEY",
  "D1_INTERNAL_KEY",
  "API_SERVICE_KEY",
  "TELEGRAM_INTERNAL_KEY",
];

async function getCloudflareAccountId(): Promise<string | null> {
  return process.env.CLOUDFLARE_ACCOUNT_ID || "debc6545e63bea36be059cbc82d80ec8";
}

async function getCloudflareApiToken(): Promise<string | null> {
  return process.env.CLOUDFLARE_API_TOKEN || null;
}

export async function GET() {
  try {
    const accountId = await getCloudflareAccountId();
    const apiToken = await getCloudflareApiToken();

    if (!apiToken) {
      return NextResponse.json({
        success: true,
        secrets: INTERNAL_KEY_SECRETS.map(name => ({ name, synced: false })),
        note: "Cloudflare API token not configured - showing all as unsynced",
      });
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/hoox-dashboard/secrets`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    const pagesSecrets = new Set<string>();

    if (data.result) {
      for (const secret of data.result) {
        pagesSecrets.add(secret.name);
      }
    }

    const results = INTERNAL_KEY_SECRETS.map(name => ({
      name,
      synced: pagesSecrets.has(name),
    }));

    return NextResponse.json({
      success: true,
      secrets: results,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, secretName, secretValue } = body;

    if (action === "sync-to-pages") {
      if (!secretName) {
        return NextResponse.json({ success: false, error: "secretName required" }, { status: 400 });
      }

      if (!secretValue) {
        return NextResponse.json({
          success: false,
          error: "secretValue required for syncing",
        }, { status: 400 });
      }

      const accountId = await getCloudflareAccountId();
      const apiToken = await getCloudflareApiToken();

      if (!apiToken) {
        return NextResponse.json({
          success: false,
          error: "Cloudflare API token not configured",
        }, { status: 400 });
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/hoox-dashboard/secrets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: secretName,
            text: secretValue,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        return NextResponse.json({
          success: true,
          message: `Successfully synced ${secretName} to hoox-dashboard`,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: data.errors?.[0]?.message || "Failed to sync secret",
        }, { status: 500 });
      }
    }

    if (action === "sync-all-internal-keys") {
      return NextResponse.json({
        success: true,
        message: "Use individual sync-to-pages for each secret. The command to run locally is:",
        command: `bun run scripts/manage.ts secrets update-cf <secretName> <workerName>`,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}