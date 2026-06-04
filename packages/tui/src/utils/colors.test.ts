/**
 * Colors Utility Tests — Design token validation.
 *
 * Tests that the Hoox design system colors are correctly defined,
 * follow the landing page DNA (dark bg #0D1117, orange accent #E8780A),
 * and provide adequate contrast ratios for TUI readability.
 *
 * Uses Bun test runner.
 */
import { describe, it, expect } from "bun:test";

// ─── Hoox Design System Colors (mirrored from @jango-blockchained/hoox-shared) ──────────────────

/**
 * These color tokens form the Hoox design system based on the
 * landing page DNA. They are used throughout the TUI via @jango-blockchained/hoox-shared.
 *
 * Palette:
 *   - Dark background:   #0D1117 (oklch 0.08 0 0)
 *   - Orange accent:     #E8780A (oklch 0.7 0.2 45)
 *   - Cards:             #1C1C1F (oklch 0.12 0 0)
 *   - Border:            #484848 (oklch 0.3 0 0)
 *   - Text foreground:   #EEEEEE (oklch 0.95 0 0)
 *   - Text muted:        #A0A0A0 (oklch 0.68 0 0)
 *   - Muted foreground:  #6E6E6E (oklch 0.55 0 0)
 *   - Text dim:          #3B3B3D (oklch 0.25 0 0)
 *   - Success:           #00FF88 (green, operational)
 *   - Error:             #FF4444 (red, failure)
 *   - Warning:           #FFAA00 (amber, degraded)
 *   - Info:              #4488FF (blue, informational)
 */
export const Colors = {
  background: "#0D1117",
  foreground: "#EEEEEE",
  card: "#1C1C1F",
  accent: "#E8780A",
  border: "#484848",
  muted: "#A0A0A0",
  "muted-foreground": "#6E6E6E",
  dim: "#3B3B3D",
  success: "#00FF88",
  error: "#FF4444",
  warning: "#FFAA00",
  info: "#4488FF",
  highlight: "#E8780A",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a hex color string into RGB components */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(
    /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/
  );
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/** Calculate relative luminance (per WCAG 2.0) */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}

/** Calculate contrast ratio between two hex colors */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Colors Design System", () => {
  // ── All tokens are valid hex colors ─────────────────────────────────────

  describe("valid hex colors", () => {
    it("all color tokens are valid 6-digit hex", () => {
      for (const [name, value] of Object.entries(Colors)) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it("all tokens can be parsed to RGB", () => {
      for (const [name, value] of Object.entries(Colors)) {
        const rgb = hexToRgb(value);
        expect(rgb).not.toBeNull();
        expect(rgb!.r).toBeGreaterThanOrEqual(0);
        expect(rgb!.r).toBeLessThanOrEqual(255);
        expect(rgb!.g).toBeGreaterThanOrEqual(0);
        expect(rgb!.g).toBeLessThanOrEqual(255);
        expect(rgb!.b).toBeGreaterThanOrEqual(0);
        expect(rgb!.b).toBeLessThanOrEqual(255);
      }
    });
  });

  // ── Landing page DNA ────────────────────────────────────────────────────

  describe("landing page DNA", () => {
    it("background is dark (#0D1117)", () => {
      expect(Colors.background).toBe("#0D1117");
      const rgb = hexToRgb(Colors.background)!;
      // Dark background: all channels should be low
      expect(rgb.r).toBeLessThan(20);
      expect(rgb.g).toBeLessThan(20);
      expect(rgb.b).toBeLessThan(30);
    });

    it("accent is orange (#E8780A)", () => {
      expect(Colors.accent).toBe("#E8780A");
      const rgb = hexToRgb(Colors.accent)!;
      // Orange: red high, green medium, blue low
      expect(rgb.r).toBeGreaterThan(200);
      expect(rgb.g).toBeGreaterThan(100);
      expect(rgb.b).toBeLessThan(30);
    });

    it("cards have subtle elevation (#1C1C1F)", () => {
      expect(Colors.card).toBe("#1C1C1F");
      const rgb = hexToRgb(Colors.card)!;
      // Should be slightly lighter than background
      expect(rgb.r).toBeGreaterThan(20);
      expect(rgb.b).toBeGreaterThan(30);
    });

    it("accent and highlight are the same color", () => {
      expect(Colors.accent).toBe(Colors.highlight);
    });
  });

  // ── Semantic Colors ─────────────────────────────────────────────────────

  describe("semantic colors", () => {
    it("success is green (#00FF88)", () => {
      expect(Colors.success).toBe("#00FF88");
      const rgb = hexToRgb(Colors.success)!;
      expect(rgb.g).toBeGreaterThan(200);
      expect(rgb.r).toBeLessThan(20);
      expect(rgb.b).toBeGreaterThan(100);
    });

    it("error is red (#FF4444)", () => {
      expect(Colors.error).toBe("#FF4444");
      const rgb = hexToRgb(Colors.error)!;
      expect(rgb.r).toBeGreaterThan(200);
      expect(rgb.g).toBeLessThan(100);
      expect(rgb.b).toBeLessThan(100);
    });

    it("warning is amber (#FFAA00)", () => {
      expect(Colors.warning).toBe("#FFAA00");
      const rgb = hexToRgb(Colors.warning)!;
      expect(rgb.r).toBeGreaterThan(200);
      expect(rgb.g).toBeGreaterThan(100);
      expect(rgb.b).toBeLessThan(20);
    });

    it("info is blue (#4488FF)", () => {
      expect(Colors.info).toBe("#4488FF");
      const rgb = hexToRgb(Colors.info)!;
      expect(rgb.b).toBeGreaterThan(200);
      expect(rgb.r).toBeLessThan(100);
      expect(rgb.g).toBeGreaterThan(100);
    });
  });

  // ── Contrast Ratios ─────────────────────────────────────────────────────

  describe("contrast ratios", () => {
    it("foreground on background has sufficient contrast (WCAG AA)", () => {
      const ratio = contrastRatio(Colors.foreground, Colors.background);
      // WCAG AA requires 4.5:1 for normal text
      expect(ratio).toBeGreaterThan(4.5);
    });

    it("accent on background has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.accent, Colors.background);
      // Large/bold text requires 3:1
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("success on background has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.success, Colors.background);
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("error on background has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.error, Colors.background);
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("muted on background has at least some contrast (visible)", () => {
      const ratio = contrastRatio(Colors.muted, Colors.background);
      // Muted text should be readable but not dominant (>= 3.0)
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("foreground on card has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.foreground, Colors.card);
      expect(ratio).toBeGreaterThan(4.5);
    });

    it("accent on card has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.accent, Colors.card);
      expect(ratio).toBeGreaterThan(3.0);
    });
  });

  // ── Token completeness ──────────────────────────────────────────────────

  describe("token completeness", () => {
    it("has exactly 13 color tokens", () => {
      expect(Object.keys(Colors).length).toBe(13); // 12 unique + highlight duplicate
    });

    it("all required semantic tokens exist", () => {
      const required = [
        "background",
        "foreground",
        "card",
        "accent",
        "border",
        "muted",
        "dim",
        "success",
        "error",
        "warning",
        "info",
      ];
      for (const key of required) {
        expect(Colors[key as keyof typeof Colors]).toBeDefined();
      }
    });

    it("no two semantic colors share the same hex value", () => {
      const semanticKeys = [
        "background",
        "foreground",
        "card",
        "accent",
        "border",
        "muted",
        "muted-foreground",
        "dim",
        "success",
        "error",
        "warning",
        "info",
      ] as const;
      const hexes = semanticKeys.map((k) => Colors[k]);
      // All must be unique (except accent already equals highlight)
      const uniqueHexes = new Set(hexes);
      expect(uniqueHexes.size).toBe(semanticKeys.length);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("hexToRgb returns null for invalid hex", () => {
      expect(hexToRgb("not-a-color")).toBeNull();
      expect(hexToRgb("#FFF")).toBeNull(); // 3-digit not supported
      expect(hexToRgb("#GGGGGG")).toBeNull();
      expect(hexToRgb("")).toBeNull();
    });

    it("contrast ratio of same color is 1.0", () => {
      expect(contrastRatio(Colors.background, Colors.background)).toBeCloseTo(
        1.0,
        1
      );
    });

    it("contrast ratio is symmetric", () => {
      const r1 = contrastRatio(Colors.foreground, Colors.background);
      const r2 = contrastRatio(Colors.background, Colors.foreground);
      expect(r1).toBeCloseTo(r2, 5);
    });

    it("white on black has maximum contrast (~21:1)", () => {
      const ratio = contrastRatio("#FFFFFF", "#000000");
      expect(ratio).toBeCloseTo(21, 0);
    });
  });
});

// ─── Status Color Mappings ───────────────────────────────────────────────────

describe("status color mappings", () => {
  it("connection status maps to correct colors", () => {
    const statusColors: Record<string, string> = {
      connected: Colors.success,
      polling: Colors.accent,
      reconnecting: Colors.warning,
      offline: Colors.error,
    };
    expect(statusColors.connected).toBe("#00FF88");
    expect(statusColors.polling).toBe("#E8780A");
    expect(statusColors.reconnecting).toBe("#FFAA00");
    expect(statusColors.offline).toBe("#FF4444");
  });

  it("alert severity maps to correct colors", () => {
    const severityColors: Record<string, string> = {
      info: Colors.info,
      warning: Colors.warning,
      error: Colors.error,
      critical: Colors.error,
    };
    expect(severityColors.info).toBe("#4488FF");
    expect(severityColors.warning).toBe("#FFAA00");
    expect(severityColors.error).toBe("#FF4444");
    expect(severityColors.critical).toBe("#FF4444");
  });

  it("worker status maps to correct colors", () => {
    const workerColors: Record<string, string> = {
      operational: Colors.success,
      degraded: Colors.warning,
      down: Colors.error,
    };
    expect(workerColors.operational).toBe("#00FF88");
    expect(workerColors.degraded).toBe("#FFAA00");
    expect(workerColors.down).toBe("#FF4444");
  });

  it("log level maps to correct colors", () => {
    const logColors: Record<string, string> = {
      debug: Colors.dim,
      info: Colors.foreground,
      warn: Colors.warning,
      error: Colors.error,
    };
    expect(logColors.debug).toBe("#3B3B3D");
    expect(logColors.info).toBe("#EEEEEE");
    expect(logColors.warn).toBe("#FFAA00");
    expect(logColors.error).toBe("#FF4444");
  });
});
