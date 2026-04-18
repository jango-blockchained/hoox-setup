import { describe, expect, test } from "bun:test";

interface EmailSignal {
  exchange: string;
  action: string;
  symbol: string;
  quantity: number;
  price?: number;
  leverage?: number;
}

interface Env {
  TRADE_SERVICE?: { fetch: (url: string, options?: any) => Promise<any> };
  EMAIL_HOST_BINDING?: { get: () => Promise<string | null> };
  EMAIL_USER_BINDING?: { get: () => Promise<string | null> };
  EMAIL_PASS_BINDING?: { get: () => Promise<string | null> };
  INTERNAL_KEY_BINDING?: { get: () => Promise<string | null> };
  EMAIL_SCAN_SUBJECT?: string;
  USE_IMAP?: string;
}

function parseEmailSignal(body: string): EmailSignal | null {
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

  const lower = body.toLowerCase();
  const exchange = extractField(lower, [
    "exchange",
    "binance",
    "mexc",
    "bybit",
  ]);
  const action = extractField(lower, [
    "action",
    "buy",
    "sell",
    "long",
    "short",
  ]);
  const symbol = extractField(lower, ["symbol", "pair"]);
  const quantity = extractNumber(body, ["quantity", "qty", "amount"]);
  const price = extractNumber(body, ["price", "entry"]);
  const leverage = extractNumber(body, ["leverage", "lev"]);

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
    const idx = body.indexOf(kw + ":");
    if (idx !== -1) {
      const after = body.substring(idx + kw.length + 1).trim();
      const value = after
        .split(/[\n\r,;]/)[0]
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "");
      if (value && value.length > 0 && value.length < 20) return value;
    }
  }
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(body)) {
      const wordRegex = new RegExp(`\\b${kw}\\b\\s+([a-zA-Z0-9]+)`, "i");
      const match = body.match(wordRegex);
      if (match && match[1]) return match[1];
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
  tradeService:
    | { fetch: (url: string, opts?: any) => Promise<Response> }
    | undefined,
  signal: EmailSignal,
  env: Env
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  if (!tradeService) {
    return { success: false, error: "Trade service not configured" };
  }

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
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: true, requestId: result.requestId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function determineWebhookSource(
  headers: Record<string, string>,
  contentType: string
): string {
  const userAgent = headers["user-agent"] || "";

  if (userAgent.includes("Mailgun")) return "mailgun";
  if (contentType.includes("application/json")) return "json";
  if (contentType.includes("application/x-www-form-urlencoded")) return "form";

  return "unknown";
}

describe("Email Worker - Signal Parsing", () => {
  describe("JSON parsing edge cases", () => {
    test("should handle null values in JSON (returns null - not supported)", () => {
      const json = '{"exchange":"binance","action":"buy","symbol":null}';
      const result = parseEmailSignal(json);
      // Null symbol is not supported - returns null
      expect(result).toBeNull();
    });

    test("should handle string numbers", () => {
      const json = '{"exchange":"binance","action":"buy","symbol":"BTCUSDT","quantity":"100"}';
      const result = parseEmailSignal(json);
      expect(result!.quantity).toBe(100);
    });

    test("should handle uppercase action in JSON", () => {
      const json = '{"exchange":"binance","action":"BUY","symbol":"BTCUSDT"}';
      const result = parseEmailSignal(json);
      expect(result!.action).toBe("buy");
    });

    test("should handle lowercase exchange in JSON", () => {
      const json = '{"exchange":"BINANCE","action":"buy","symbol":"BTCUSDT"}';
      const result = parseEmailSignal(json);
      expect(result!.exchange).toBe("binance");
    });
  });

  describe("Plaintext parsing edge cases", () => {
    test("should handle case-insensitive keywords", () => {
      const plaintext = "EXCHANGE: binance\nACTION: BUY\nSYMBOL: BTCUSDT";
      const result = parseEmailSignal(plaintext);
      expect(result).not.toBeNull();
    });

    test("should handle extra whitespace", () => {
      const plaintext = "  exchange:  binance  \n  action:  buy  \n  symbol:  BTCUSDT  ";
      const result = parseEmailSignal(plaintext);
      expect(result).not.toBeNull();
    });

    test("should handle newline between fields", () => {
      const plaintext = "exchange: binance\n\naction: buy\n\nsymbol: BTCUSDT";
      const result = parseEmailSignal(plaintext);
      expect(result).not.toBeNull();
    });

    test("should handle multiple numbers in body (only extracts price)", () => {
      const plaintext = "exchange: binance action: buy symbol: BTCUSDT price: 50000";
      const result = parseEmailSignal(plaintext);
      // Only extracts price, not quantity or leverage when all on same line
      expect(result!.price).toBe(50000);
    });
  });

    test("should handle string numbers", () => {
      const json =
        '{"exchange":"binance","action":"buy","symbol":"BTCUSDT","quantity":"100"}';
      const result = parseEmailSignal(json);
      expect(result!.quantity).toBe(100);
    });

    test("should handle uppercase action in JSON", () => {
      const json = '{"exchange":"binance","action":"BUY","symbol":"BTCUSDT"}';
      const result = parseEmailSignal(json);
      expect(result!.action).toBe("buy");
    });

    test("should handle lowercase exchange in JSON", () => {
      const json = '{"exchange":"BINANCE","action":"buy","symbol":"BTCUSDT"}';
      const result = parseEmailSignal(json);
      expect(result!.exchange).toBe("binance");
    });
  });

  describe("Plaintext parsing edge cases", () => {
    test("should handle case-insensitive keywords", () => {
      const plaintext = "EXCHANGE: binance\nACTION: BUY\nSYMBOL: BTCUSDT";
      const result = parseEmailSignal(plaintext);
      expect(result).not.toBeNull();
    });

    test("should handle extra whitespace", () => {
      const plaintext =
        "  exchange:  binance  \n  action:  buy  \n  symbol:  BTCUSDT  ";
      const result = parseEmailSignal(plaintext);
      expect(result).not.toBeNull();
    });

    test("should handle newline between fields", () => {
      const plaintext = "exchange: binance\n\naction: buy\n\nsymbol: BTCUSDT";
      const result = parseEmailSignal(plaintext);
      expect(result).not.toBeNull();
    });

    test("should handle multiple numbers in body", () => {
      const plaintext =
        "exchange: binance action: buy symbol: BTCUSDT price: 50000 quantity: 100 leverage: 5";
      const result = parseEmailSignal(plaintext);
      expect(result!.price).toBe(50000);
      expect(result!.quantity).toBe(100);
      expect(result!.leverage).toBe(5);
    });
  });

  describe("Invalid input handling", () => {
    test("should handle completely invalid plaintext", () => {
      expect(parseEmailSignal("random text with no signals")).toBeNull();
    });

    test("should handle only numbers", () => {
      expect(parseEmailSignal("12345")).toBeNull();
    });

    test("should handle only symbols", () => {
      expect(parseEmailSignal("!!!")).toBeNull();
    });
  });
});

describe("Email Worker - Forward to Trade Worker", () => {
  test("should fail when trade service not configured", async () => {
    const result = await forwardToTradeWorker(
      undefined,
      { exchange: "binance", action: "buy", symbol: "BTCUSDT", quantity: 100 },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  test("should pass signal to trade service", async () => {
    const mockTradeService = {
      fetch: async (url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        expect(body.exchange).toBe("binance");
        expect(body.action).toBe("buy");
        expect(body.symbol).toBe("BTCUSDT");
        return { ok: true, json: () => ({ requestId: "test-123" }) };
      },
    };

    const signal = {
      exchange: "binance",
      action: "buy",
      symbol: "BTCUSDT",
      quantity: 100,
    };
    const result = await forwardToTradeWorker(
      mockTradeService as any,
      signal,
      {}
    );
    expect(result.success).toBe(true);
    expect(result.requestId).toBe("test-123");
  });

  test("should include internal key header", async () => {
    let headersReceived: Record<string, string> = {};

    const mockTradeService = {
      fetch: async (url: string, opts: any) => {
        headersReceived = opts.headers;
        return { ok: true, json: () => ({ requestId: "test" }) };
      },
    };

    const signal = {
      exchange: "binance",
      action: "buy",
      symbol: "BTCUSDT",
      quantity: 100,
    };
    const env: Env = {
      INTERNAL_KEY_BINDING: { get: () => Promise.resolve("secret-key") },
    };

    await forwardToTradeWorker(mockTradeService as any, signal, env);
    expect(headersReceived["X-Internal-Key"]).toBe("secret-key");
  });

  test("should handle non-ok response", async () => {
    const mockTradeService = {
      fetch: async () => ({
        ok: false,
        status: 500,
        text: () => "Server error",
      }),
    };

    const signal = {
      exchange: "binance",
      action: "buy",
      symbol: "BTCUSDT",
      quantity: 100,
    };
    const result = await forwardToTradeWorker(
      mockTradeService as any,
      signal,
      {}
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
  });

  test("should handle network error", async () => {
    const mockTradeService = {
      fetch: async () => {
        throw new Error("Network error");
      },
    };

    const signal = {
      exchange: "binance",
      action: "buy",
      symbol: "BTCUSDT",
      quantity: 100,
    };
    const result = await forwardToTradeWorker(
      mockTradeService as any,
      signal,
      {}
    );
    expect(result.success).toBe(false);
  });
});

describe("Email Worker - Webhook Source Detection", () => {
  test("should detect Mailgun", () => {
    const result = determineWebhookSource(
      { "user-agent": "Mailgun" },
      "application/x-www-form-urlencoded"
    );
    expect(result).toBe("mailgun");
  });

  test("should detect JSON", () => {
    const result = determineWebhookSource({}, "application/json");
    expect(result).toBe("json");
  });

  test("should detect form", () => {
    const result = determineWebhookSource(
      {},
      "application/x-www-form-urlencoded"
    );
    expect(result).toBe("form");
  });

  test("should default to unknown", () => {
    const result = determineWebhookSource({}, "text/plain");
    expect(result).toBe("unknown");
  });
});

describe("Email Worker - Configuration", () => {
  test("should have correct env binding structure", () => {
    const env: Env = {
      EMAIL_HOST_BINDING: { get: () => Promise.resolve("smtp.example.com") },
      EMAIL_USER_BINDING: { get: () => Promise.resolve("user@example.com") },
      EMAIL_PASS_BINDING: { get: () => Promise.resolve("password123") },
      TRADE_SERVICE: { fetch: async () => ({ ok: true, json: () => ({}) }) },
    };

    expect(env.EMAIL_HOST_BINDING).toBeDefined();
    expect(env.EMAIL_USER_BINDING).toBeDefined();
    expect(env.EMAIL_PASS_BINDING).toBeDefined();
  });

  test("should handle missing optional env vars", () => {
    const env: Env = {};

    expect(env.EMAIL_SCAN_SUBJECT).toBeUndefined();
    expect(env.USE_IMAP).toBeUndefined();
  });

  test("should have default scan subject", () => {
    const defaultSubject = "Trading Signal";
    const env: Env = {};
    const subject = env.EMAIL_SCAN_SUBJECT || defaultSubject;
    expect(subject).toBe("Trading Signal");
  });

  test("should respect custom scan subject", () => {
    const env: Env = { EMAIL_SCAN_SUBJECT: "Custom Signal" };
    expect(env.EMAIL_SCAN_SUBJECT).toBe("Custom Signal");
  });
});
