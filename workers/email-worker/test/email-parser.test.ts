import { describe, expect, test } from "bun:test";

interface EmailSignal {
  exchange: string;
  action: string;
  symbol: string;
  quantity: number;
  price?: number;
  leverage?: number;
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
    "exchange",
    "binance",
    "mexc",
    "bybit",
    "bitget",
  ]);
  const action = extractField(lower, [
    "action",
    "buy",
    "sell",
    "long",
    "short",
    "close",
  ]);
  const symbol = extractField(lower, ["symbol", "pair"]);
  const quantity = extractNumber(body, ["quantity", "qty", "amount", "size"]);
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
  // First try with colon (key:)
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
  // Then try keyword as standalone word
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

describe("Email Signal Parsing", () => {
  describe("JSON format", () => {
    test("should parse valid JSON signal", () => {
      const json =
        '{"exchange":"binance","action":"buy","symbol":"BTCUSDT","quantity":100}';
      const result = parseEmailSignal(json);
      expect(result).not.toBeNull();
      expect(result!.exchange).toBe("binance");
      expect(result!.action).toBe("buy");
      expect(result!.symbol).toBe("BTCUSDT");
      expect(result!.quantity).toBe(100);
    });

    test("should parse JSON with price and leverage", () => {
      const json =
        '{"exchange":"mexc","action":"sell","symbol":"ETHUSDT","quantity":50,"price":2500.5,"leverage":5}';
      const result = parseEmailSignal(json);
      expect(result).not.toBeNull();
      expect(result!.price).toBe(2500.5);
      expect(result!.leverage).toBe(5);
    });

    test("should default quantity to 100", () => {
      const json = '{"exchange":"bybit","action":"buy","symbol":"SOLUSDT"}';
      const result = parseEmailSignal(json);
      expect(result!.quantity).toBe(100);
    });

    test("should return null for incomplete JSON", () => {
      const json = '{"exchange":"binance","symbol":"BTCUSDT"}';
      expect(parseEmailSignal(json)).toBeNull();
    });
  });

  describe("Plaintext format", () => {
    test("should parse with colons", () => {
      const plaintext =
        "exchange: binance\naction: buy\nsymbol: BTCUSDT\nquantity: 150";
      const result = parseEmailSignal(plaintext);
      expect(result).not.toBeNull();
      expect(result!.exchange).toBe("binance");
      expect(result!.action).toBe("buy");
    });

    test("should parse action buy/long as buy", () => {
      expect(
        parseEmailSignal("exchange binance action long symbol BTCUSDT")
      ).not.toBeNull();
    });

    test("should parse action sell/short as sell", () => {
      expect(
        parseEmailSignal("exchange binance action short symbol BTCUSDT")
      ).not.toBeNull();
    });

    test("should extract price", () => {
      const result = parseEmailSignal(
        "exchange binance action buy symbol BTCUSDT price 50000"
      );
      expect(result!.price).toBe(50000);
    });

    test("should extract leverage", () => {
      const result = parseEmailSignal(
        "exchange binance action buy symbol BTCUSDT leverage 10"
      );
      expect(result!.leverage).toBe(10);
    });
  });

  describe("Edge cases", () => {
    test("should handle empty string", () => {
      expect(parseEmailSignal("")).toBeNull();
    });

    test("should handle whitespace", () => {
      expect(parseEmailSignal("   \n\n   ")).toBeNull();
    });

    test("should prioritize JSON over plaintext", () => {
      const body = '{"exchange":"binance","action":"buy","symbol":"BTCUSDT"}';
      expect(parseEmailSignal(body)).not.toBeNull();
    });

    test("should clean symbols", () => {
      const result = parseEmailSignal(
        "exchange: binance\naction: buy\nsymbol: BTC/USDT"
      );
      expect(result!.symbol).toBe("BTCUSDT");
    });
  });
});
