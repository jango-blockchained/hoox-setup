/**
 * Unit tests for formatting utilities
 * Run with: bun test packages/shared/tests/formatters.test.ts
 */

import { describe, test, expect } from "bun:test";
import {
  formatNumber,
  formatCurrency,
  formatCompactCurrency,
  formatDuration,
  formatDurationCompact,
  formatTimestamp,
  formatRelativeTime,
  formatPercent,
  formatUptime,
  formatLatency,
  formatRequests,
  formatMemory,
  formatCpu,
} from "../src/formatters";

describe("formatNumber", () => {
  test("returns '—' for non-finite values", () => {
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
    expect(formatNumber(-Infinity)).toBe("—");
  });

  test("formats at B threshold (1e9)", () => {
    expect(formatNumber(1e9)).toBe("1.0B");
    expect(formatNumber(2.5e9)).toBe("2.5B");
    expect(formatNumber(-1e9)).toBe("-1.0B");
  });

  test("formats at M threshold (1e6)", () => {
    expect(formatNumber(1e6)).toBe("1.0M");
    expect(formatNumber(5e6)).toBe("5.0M");
    expect(formatNumber(-2e6)).toBe("-2.0M");
  });

  test("formats at K threshold (1e3)", () => {
    expect(formatNumber(1e3)).toBe("1.0K");
    expect(formatNumber(9999)).toBe("10.0K");
    // -500 has abs < 1e3, so it falls through to locale string
    expect(formatNumber(-500)).toBe("-500");
  });

  test("uses locale string for numbers below K threshold", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(999)).toBe("999");
  });

  test("handles exact boundary values", () => {
    expect(formatNumber(999999999)).toBe("1000.0M");
    expect(formatNumber(999999)).toBe("1000.0K");
  });
});

describe("formatCurrency", () => {
  test("returns '—' for non-finite values", () => {
    expect(formatCurrency(NaN)).toBe("—");
    expect(formatCurrency(Infinity)).toBe("—");
  });

  test("positive values get + prefix", () => {
    expect(formatCurrency(100)).toBe("+$100.00");
    expect(formatCurrency(1500)).toBe("+$1.50K");
    expect(formatCurrency(2e6)).toBe("+$2.00M");
  });

  test("negative values get - prefix", () => {
    expect(formatCurrency(-100)).toBe("-$100.00");
    expect(formatCurrency(-1500)).toBe("-$1.50K");
  });

  test("sub-K values have 2 decimal places", () => {
    expect(formatCurrency(123.456)).toBe("+$123.46");
    expect(formatCurrency(999.99)).toBe("+$999.99");
  });
});

describe("formatCompactCurrency", () => {
  test("returns '—' for non-finite values", () => {
    expect(formatCompactCurrency(NaN)).toBe("—");
    expect(formatCompactCurrency(Infinity)).toBe("—");
  });

  test("positive values have no sign prefix", () => {
    expect(formatCompactCurrency(100)).toBe("$100.00");
    expect(formatCompactCurrency(1500)).toBe("$1.50K");
    expect(formatCompactCurrency(2e6)).toBe("$2.00M");
  });

  test("negative values get - prefix", () => {
    expect(formatCompactCurrency(-100)).toBe("-$100.00");
    expect(formatCompactCurrency(-1500)).toBe("-$1.50K");
  });
});

describe("formatDuration", () => {
  test("returns '—' for negative/NaN/Infinity", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
    expect(formatDuration(Infinity)).toBe("—");
  });

  test("formats seconds only", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(0)).toBe("0s");
  });

  test("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1m 30s");
  });

  test("formats hours minutes and seconds", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
  });

  test("formats days hours minutes and seconds", () => {
    expect(formatDuration(90061)).toBe("1d 1h 1m 1s");
  });

  test("always includes seconds even when 0", () => {
    expect(formatDuration(3600)).toBe("1h 0m 0s");
    expect(formatDuration(86400)).toBe("1d 0h 0m 0s");
  });
});

describe("formatDurationCompact", () => {
  test("returns '—' for negative/NaN/Infinity", () => {
    expect(formatDurationCompact(-1)).toBe("—");
    expect(formatDurationCompact(NaN)).toBe("—");
  });

  test("returns days and hours when d > 0", () => {
    expect(formatDurationCompact(90000)).toBe("1d 1h");
    expect(formatDurationCompact(172800)).toBe("2d 0h");
  });

  test("returns hours and minutes when h > 0 but d = 0", () => {
    expect(formatDurationCompact(3660)).toBe("1h 1m");
    // 3599999s = 41 days + remainder, so d > 0 path is taken
    expect(formatDurationCompact(3599999)).toBe("41d 15h");
  });

  test("returns minutes when only m > 0", () => {
    expect(formatDurationCompact(120)).toBe("2m");
    // 59s -> m=0, goes to seconds path
    expect(formatDurationCompact(59)).toBe("59s");
  });

  test("returns seconds when < 60", () => {
    expect(formatDurationCompact(45)).toBe("45s");
    expect(formatDurationCompact(0)).toBe("0s");
  });

  test("floors fractional seconds", () => {
    expect(formatDurationCompact(45.9)).toBe("45s");
  });
});

describe("formatTimestamp", () => {
  test("returns original string on invalid ISO date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
    expect(formatTimestamp("")).toBe("");
  });

  test("returns time in 24h format (HH:MM:SS)", () => {
    const result = formatTimestamp("2025-01-15T14:30:00.000Z");
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe("formatRelativeTime", () => {
  test("returns 'just now' for future timestamps", () => {
    expect(formatRelativeTime(Date.now() + 10000)).toBe("just now");
  });

  test("returns seconds ago when < 60s", () => {
    expect(formatRelativeTime(Date.now() - 30000)).toBe("30s ago");
    expect(formatRelativeTime(Date.now() - 1000)).toBe("1s ago");
  });

  test("returns minutes ago when 60s <= diff < 60m", () => {
    expect(formatRelativeTime(Date.now() - 120000)).toBe("2m ago");
    expect(formatRelativeTime(Date.now() - 60000)).toBe("1m ago");
  });

  test("returns hours ago when 60m <= diff < 24h", () => {
    expect(formatRelativeTime(Date.now() - 3600000)).toBe("1h ago");
    expect(formatRelativeTime(Date.now() - 7200000)).toBe("2h ago");
  });

  test("returns days ago when diff >= 24h", () => {
    expect(formatRelativeTime(Date.now() - 172800000)).toBe("2d ago");
    expect(formatRelativeTime(Date.now() - 86400000)).toBe("1d ago");
  });
});

describe("formatPercent", () => {
  test("returns '—' for non-finite values", () => {
    expect(formatPercent(NaN)).toBe("—");
    expect(formatPercent(Infinity)).toBe("—");
  });

  test("positive values get + prefix", () => {
    expect(formatPercent(5.5)).toBe("+5.50%");
    expect(formatPercent(0)).toBe("+0.00%");
  });

  test("negative values have no + prefix", () => {
    expect(formatPercent(-3.2)).toBe("-3.20%");
  });

  test("default 2 decimal places", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
  });

  test("toFixed rounds (not truncates) to specified decimal places", () => {
    // 1.2345 in IEEE 754 double is slightly under (1.2344999...), so 3dp gives "1.234"
    expect(formatPercent(1.2345, 3)).toBe("+1.234%");
    expect(formatPercent(1.9999, 2)).toBe("+2.00%");
  });

  test("respects custom decimal count", () => {
    expect(formatPercent(1.2345, 0)).toBe("+1%");
    expect(formatPercent(1.2345, 4)).toBe("+1.2345%");
  });
});

describe("formatUptime", () => {
  test("delegates to formatDuration", () => {
    expect(formatUptime(3661)).toBe(formatDuration(3661));
    expect(formatUptime(0)).toBe(formatDuration(0));
  });
});

describe("formatLatency", () => {
  test("returns '—' for non-finite values", () => {
    expect(formatLatency(NaN)).toBe("—");
    expect(formatLatency(Infinity)).toBe("—");
  });

  test("returns '<1ms' for ms < 1", () => {
    expect(formatLatency(0.5)).toBe("<1ms");
    expect(formatLatency(0.1)).toBe("<1ms");
  });

  test("formats as ms for 1 <= ms < 1000", () => {
    expect(formatLatency(1)).toBe("1ms");
    expect(formatLatency(50)).toBe("50ms");
    expect(formatLatency(999)).toBe("999ms");
  });

  test("formats as seconds for ms >= 1000", () => {
    expect(formatLatency(1000)).toBe("1.0s");
    expect(formatLatency(2500)).toBe("2.5s");
  });

  test("rounds to nearest integer ms", () => {
    expect(formatLatency(50.7)).toBe("51ms");
    expect(formatLatency(50.3)).toBe("50ms");
  });
});

describe("formatRequests", () => {
  test("delegates to formatNumber", () => {
    expect(formatRequests(5000)).toBe(formatNumber(5000));
    expect(formatRequests(0)).toBe(formatNumber(0));
  });
});

describe("formatMemory", () => {
  test("formats used/limit MB", () => {
    expect(formatMemory(512, 1024)).toBe("512/1024 MB");
    expect(formatMemory(0, 100)).toBe("0/100 MB");
  });

  test("toFixed(0) rounds to nearest integer", () => {
    expect(formatMemory(512.7, 1024.3)).toBe("513/1024 MB");
    // 1024.7.toFixed(0) = 1025 (rounds up from .7)
    expect(formatMemory(512.3, 1024.7)).toBe("512/1025 MB");
  });
});

describe("formatCpu", () => {
  test("returns '—' for non-finite values", () => {
    expect(formatCpu(NaN)).toBe("—");
    expect(formatCpu(Infinity)).toBe("—");
  });

  test("formats with 1 decimal place and ms suffix", () => {
    expect(formatCpu(123.456)).toBe("123.5ms");
    expect(formatCpu(0)).toBe("0.0ms");
    expect(formatCpu(0.1)).toBe("0.1ms");
  });
});
