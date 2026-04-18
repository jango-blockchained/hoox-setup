// email-worker/src/index.ts - Scans email inbox and forwards signals to trade-worker

import type { Fetcher } from "@cloudflare/workers-types";

interface SecretBinding {
  get: () => Promise<string | null>;
}

interface Env {
  TRADE_SERVICE: Fetcher;
  EMAIL_HOST_BINDING?: SecretBinding;
  EMAIL_USER_BINDING?: SecretBinding;
  EMAIL_PASS_BINDING?: SecretBinding;
  INTERNAL_KEY_BINDING?: SecretBinding;
  EMAIL_SCAN_SUBJECT?: string;
  USE_IMAP?: string;
}

interface EmailSignal {
  exchange: string;
  action: string;
  symbol: string;
  quantity: number;
  price?: number;
  leverage?: number;
}

interface ServiceResponse {
  success: boolean;
  requestId?: string;
  tradeResult?: unknown;
  error?: string;
}

const DEFAULT_SCAN_SUBJECT = "Trading Signal";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const contentType = request.headers.get("content-type") || "";
    const userAgent = request.headers.get("user-agent") || "";

    // Route based on incoming webhook format
    if (
      userAgent.includes("Mailgun") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      return await handleMailgunWebhook(request, env);
    }

    if (contentType.includes("application/json")) {
      // Could be SendGrid, Gmail, or manual JSON POST
      const json = (await request.json()) as Record<string, unknown>;

      // Detect Gmail (has specific fields)
      if (json.emailAddress || json.historyId || json.messages) {
        return await handleGmailWebhook(request, env);
      }

      // SendGrid or direct JSON
      return await handleDirectJson(request, env);
    }

    if (request.method === "GET" || request.method === "POST") {
      if (env.USE_IMAP === "true") {
        return await handleIMAPScan(env);
      }
      return new Response(
        `Email Worker Ready\n\n` +
          `Supported Webhooks:\n` +
          `- Mailgun (application/x-www-form-urlencoded)\n` +
          `- SendGrid (application/json)\n` +
          `- Gmail API push notifications (application/json)\n` +
          `- Direct JSON POST\n\n` +
          `Set USE_IMAP=true for IMAP inbox scanning`,
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    return new Response("Email worker ready", {
      headers: { "Content-Type": "text/plain" },
    });
  },

  async scheduled(env: Env): Promise<void> {
    if (env.USE_IMAP === "true") {
      await handleIMAPScan(env);
    }
  },
};

// --- Mailgun Webhook Handler ---
async function handleMailgunWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const formData = await request.formData();

    const subject = formData.get("subject")?.toString() || "";
    const body =
      formData.get("body-plain")?.toString() ||
      formData.get("stripped-text")?.toString() ||
      "";
    const sender = formData.get("sender")?.toString() || "";
    const recipient = formData.get("recipient")?.toString() || "";
    const messageId = formData.get("message-id")?.toString() || "";

    console.log(
      `[Mailgun] From: ${sender}, Subject: ${subject}, ID: ${messageId}`
    );

    return await processEmail(subject, body, "mailgun", env);
  } catch (error) {
    console.error("[Mailgun] Error:", error);
    return errorResponse(error);
  }
}

// --- SendGrid / Direct JSON Handler ---
async function handleDirectJson(request: Request, env: Env): Promise<Response> {
  try {
    const json = (await request.json()) as Record<string, unknown>;

    const subject = json.subject?.toString() || "";
    const body =
      json.text?.toString() || json.body?.toString() || JSON.stringify(json);
    const from = json.from?.toString() || "";

    console.log(`[SendGrid/Direct] From: ${from}, Subject: ${subject}`);

    return await processEmail(subject, body, "sendgrid", env);
  } catch (error) {
    console.error("[SendGrid] Error:", error);
    return errorResponse(error);
  }
}

// --- Gmail Webhook Handler (Google Workspace / Gmail API) ---
async function handleGmailWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const json = (await request.json()) as GmailNotification;

    // Gmail sends a notification that email was changed
    // You need to call Gmail API to get the actual email content
    // This requires: EMAIL_USER = gmail email, EMAIL_PASS = app-specific password

    const emailAddress =
      json.emailAddress || (await env.EMAIL_USER_BINDING?.get());
    const historyId = json.historyId;

    console.log(
      `[Gmail] Notification for ${emailAddress}, history: ${historyId}`
    );

    // In production, you'd use Gmail API to fetch the new email
    // For now, return a placeholder indicating the webhook was received
    // To implement full Gmail support, you need to:
    // 1. Use Gmail API with OAuth2 or app-specific password
    // 2. Call users.messages.get() with the history changes

    // For basic Gmail webhook, we need to fetch the actual email
    // This would require additional API calls

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Gmail webhook received. For full email content, configure Gmail API credentials.",
        emailAddress,
        historyId,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Gmail] Error:", error);
    return errorResponse(error);
  }
}

// --- IMAP Scanner ---
async function handleIMAPScan(env: Env): Promise<Response> {
  try {
    const host = await env.EMAIL_HOST_BINDING?.get();
    const user = await env.EMAIL_USER_BINDING?.get();
    const pass = await env.EMAIL_PASS_BINDING?.get();
    const scanSubject = env.EMAIL_SCAN_SUBJECT || DEFAULT_SCAN_SUBJECT;

    if (!host || !user || !pass) {
      return new Response("Error: Missing IMAP credentials", { status: 500 });
    }

    console.log(`[IMAP] Scanning ${user}@${host} for: ${scanSubject}`);

    // Import IMAP dynamically
    let imap: any;
    try {
      imap = await import("imap-simple");
    } catch {
      return new Response("Error: IMAP library not available", { status: 500 });
    }

    const config = {
      imap: {
        user,
        password: pass,
        host,
        port: 993,
        tls: true,
        authTimeout: 10000,
      },
    };

    const connection = await imap.connect(config);
    await connection.openBox("INBOX");

    const searchCriteria = ["UNSEEN", `SUBJECT ${scanSubject}`];
    const emails = await connection.search(searchCriteria, {
      bodies: ["HEADER", "TEXT"],
      markSeen: false,
    });

    console.log(`[IMAP] Found ${emails.length} emails`);

    let processedCount = 0;
    for (const email of emails) {
      const subject = email.headers.subject?.[0] || "No Subject";
      let body = "";
      if (email.body) {
        const textPart = email.body.find((p: any) => p.which === "TEXT");
        if (textPart) body = textPart.body;
      }

      const result = await processEmail(
        subject,
        body.substring(0, 5000),
        "imap",
        env
      );
      if (result.status === 200) processedCount++;
    }

    connection.end();

    return new Response(
      `Scanned ${emails.length}, processed ${processedCount} signals.`
    );
  } catch (error) {
    console.error("[IMAP] Error:", error);
    return errorResponse(error);
  }
}

// --- Core Email Processing ---
async function processEmail(
  subject: string,
  body: string,
  source: string,
  env: Env
): Promise<Response> {
  console.log(`[${source}] Processing: ${subject}`);

  // Parse trading signal from email body
  const signal = parseEmailSignal(body);

  if (!signal) {
    console.log(`[${source}] No valid signal found`);
    return new Response(
      JSON.stringify({
        success: false,
        error: "No valid trading signal in email",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[${source}] Signal: ${JSON.stringify(signal)}`);

  // Forward to trade-worker
  const result = await forwardToTradeWorker(env.TRADE_SERVICE, signal, env);

  if (result.success) {
    return new Response(
      JSON.stringify({
        success: true,
        requestId: result.requestId,
        signal,
        source,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } else {
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function parseEmailSignal(body: string): EmailSignal | null {
  // Try JSON first
  try {
    const data = JSON.parse(body);
    if (data.exchange && data.action && data.symbol) {
      return {
        exchange: String(data.exchange).toLowerCase(),
        action: normalizeAction(String(data.action)),
        symbol: String(data.symbol).toUpperCase(),
        quantity: Number(data.quantity) || 100,
        price: data.price ? Number(data.price) : undefined,
        leverage: data.leverage ? Number(data.leverage) : undefined,
      };
    }
  } catch {}

  // Plaintext extraction
  const lower = body.toLowerCase();

  const exchange = extractField(lower, [
    "exchange:",
    "binance",
    "mexc",
    "bybit",
    "bitget",
  ]);
  const action = extractField(lower, [
    "action:",
    "buy",
    "sell",
    "long",
    "short",
    "close",
  ]);
  const symbol = extractField(lower, ["symbol:", "pair:", "pair", "market"]);
  const quantity = extractNumber(body, [
    "quantity:",
    "qty:",
    "amount:",
    "size:",
    "quantity",
    "amount",
    "size",
  ]);
  const price = extractNumber(body, ["price:", "entry:", "price"]);
  const leverage = extractNumber(body, [
    "leverage:",
    "lev:",
    "leverage",
    "lev",
  ]);

  if (exchange && action && symbol) {
    return {
      exchange: normalizeExchange(exchange),
      action: normalizeAction(action),
      symbol: symbol.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      quantity: quantity || 100,
      price: price || undefined,
      leverage: leverage || undefined,
    };
  }

  return null;
}

function extractField(body: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const idx = body.indexOf(kw);
    if (idx !== -1) {
      const after = body.substring(idx + kw.length).trim();
      const value = after
        .split(/[\n\r,;]/)[0]
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "");
      if (value && value.length > 0 && value.length < 20) return value;
    }
  }
  return null;
}

function extractNumber(body: string, keywords: string[]): number | undefined {
  for (const kw of keywords) {
    const regex = new RegExp(`${kw}[\\s:]*([0-9.]+)`, "i");
    const match = body.match(regex);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return undefined;
}

function normalizeExchange(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("binance")) return "binance";
  if (v.includes("mexc")) return "mexc";
  if (v.includes("bybit")) return "bybit";
  if (v.includes("bitget")) return "bitget";
  return v;
}

function normalizeAction(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("buy") || v.includes("long")) return "buy";
  if (v.includes("sell") || v.includes("short")) return "sell";
  if (v.includes("close") || v.includes("exit")) return "close";
  return v;
}

async function forwardToTradeWorker(
  tradeService: Fetcher,
  signal: EmailSignal,
  env: Env
): Promise<ServiceResponse> {
  try {
    const internalKey = await env.INTERNAL_KEY_BINDING?.get();

    const response = await tradeService.fetch(
      "https://trade-worker.internal/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": internalKey || "",
          "X-Source": "email-worker",
        },
        body: JSON.stringify(signal),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const result = await response.json();
    return { success: true, requestId: result.requestId, tradeResult: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function errorResponse(error: unknown): Response {
  return new Response(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}

// --- Types ---
interface GmailNotification {
  emailAddress?: string;
  historyId?: string;
  messages?: { id: string; threadId: string }[];
}
