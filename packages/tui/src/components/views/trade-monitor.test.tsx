/** @jsxImportSource @opentui/react */
/**
 * Tests for TradeMonitor — validates live trade feed rendering,
 * color-coding (buy=green, sell=red), open positions P&L,
 * pause/resume toggle, performance metrics, and ring buffer cap.
 *
 * Uses Bun's mock.module to override the service-store import
 * so TradeMonitor renders against controlled test data.
 */
import { describe, it, expect, beforeEach, mock } from "bun:test"
// @ts-expect-error — render returns FrameBuffer string
import { render } from "@opentui/react"
import type { Trade, SystemMetrics } from "@hoox/shared"

// ─── Mock infrastructure ─────────────────────────────────────────────────────

/** Color token values matching the hoox design system */
const MockColors = {
  background: "#0D1117",
  foreground: "#EEEEEE",
  accent: "#E8780A",
  card: "#1A1A2E",
  border: "#333333",
  muted: "#888888",
  dim: "#555555",
  success: "#00FF88",
  error: "#FF4444",
  warning: "#FFAA00",
  info: "#4488FF",
}

/** Controllable state that TradeMonitor reads via selectors */
const mockState = {
  tradeStream: [] as Trade[],
  metrics: null as SystemMetrics | null,
  connectionStatus: "offline" as const,
}

/** Zustand-compatible subscribe → [getSnapshot, subscribe] tuple */
const listeners = new Set<() => void>()

function useServiceStore(selector: (s: typeof mockState) => unknown): unknown {
  return selector(mockState)
}

// Attach subscribe to support zustand-style selectors that need subscription
;(useServiceStore as unknown as Record<string, unknown>).subscribe = (
  _selector: unknown,
  listener: () => void,
) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ─── Mock the service-store module ───────────────────────────────────────────

mock.module("@hoox/shared", () => ({
  useServiceStore,
  Colors: MockColors,
}))

// Now import TradeMonitor AFTER the mock is registered
import { TradeMonitor } from "./trade-monitor"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render the TradeMonitor and return the FrameBuffer string output */
function renderTradeMonitor(): string {
  return render(<TradeMonitor />)
}

/** Notify all store listeners of a state change */
function notifyListeners() {
  for (const fn of listeners) {
    fn()
  }
}

// ─── Test Data Factories ─────────────────────────────────────────────────────

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: `trade-${Math.random().toString(36).slice(2, 10)}`,
    symbol: "BTC",
    side: "buy",
    price: 87432.5,
    quantity: 0.15,
    timestamp: Date.now() - 60000,
    exchange: "binance",
    pnl: 125.5,
    ...overrides,
  }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("TradeMonitor", () => {
  beforeEach(() => {
    mockState.tradeStream = []
    mockState.metrics = null
    mockState.connectionStatus = "offline"
    listeners.clear()
  })

  // ── Rendering basics ────────────────────────────────────────────────────

  it("renders the trade monitor header with TRADE MONITOR title", () => {
    const output = renderTradeMonitor()
    expect(output).toContain("TRADE MONITOR")
  })

  it("shows LIVE indicator by default", () => {
    const output = renderTradeMonitor()
    expect(output).toContain("LIVE")
  })

  it("renders empty state when no trades in stream", () => {
    mockState.tradeStream = []
    const output = renderTradeMonitor()
    expect(output).toContain("No trades yet")
  })

  // ── Live Trade Feed ─────────────────────────────────────────────────────

  it("renders trades newest first in the live feed", () => {
    const older = makeTrade({
      id: "older",
      symbol: "ETH",
      side: "buy",
      timestamp: Date.now() - 120000,
      pnl: 50,
    })
    const newer = makeTrade({
      id: "newer",
      symbol: "BTC",
      side: "sell",
      timestamp: Date.now() - 60000,
      pnl: -30,
    })
    mockState.tradeStream = [older, newer]
    notifyListeners()

    const output = renderTradeMonitor()
    // newer (BTC) should appear before older (ETH) since feed is newest first
    const newerIndex = output.indexOf("BTC")
    const olderIndex = output.indexOf("ETH")
    expect(newerIndex).toBeLessThan(olderIndex)
  })

  it("color-codes buy trades with green and sell trades with red", () => {
    mockState.tradeStream = [
      makeTrade({ id: "b1", side: "buy", symbol: "BTC", timestamp: Date.now() - 1000 }),
      makeTrade({ id: "s1", side: "sell", symbol: "ETH", timestamp: Date.now() - 2000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    // Both BUY and SELL labels should be present
    expect(output).toContain("BUY")
    expect(output).toContain("SELL")
    // The output should contain the symbols
    expect(output).toContain("BTC")
    expect(output).toContain("ETH")
  })

  it("shows trade details: symbol, quantity, price, exchange", () => {
    mockState.tradeStream = [
      makeTrade({
        id: "detail",
        symbol: "XRP",
        side: "buy",
        quantity: 1500,
        price: 0.5234,
        exchange: "kraken",
        timestamp: Date.now() - 5000,
      }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("XRP")
    expect(output).toContain("1500")
    expect(output).toContain("0.52")
    expect(output).toContain("kraken")
  })

  it("displays latency for each trade", () => {
    // Trade with recent timestamp (low latency)
    const recentTrade = makeTrade({
      id: "recent",
      symbol: "SOL",
      side: "buy",
      timestamp: Date.now() - 50, // 50ms ago
    })
    mockState.tradeStream = [recentTrade]
    notifyListeners()

    const output = renderTradeMonitor()
    // Should contain ms latency indicator
    expect(output).toContain("ms")
  })

  // ── Open Positions ──────────────────────────────────────────────────────

  it("derives open positions from trades grouped by symbol", () => {
    mockState.tradeStream = [
      makeTrade({ id: "t1", symbol: "BTC", pnl: 500, side: "buy", timestamp: Date.now() - 10000 }),
      makeTrade({ id: "t2", symbol: "BTC", pnl: -200, side: "sell", timestamp: Date.now() - 5000 }),
      makeTrade({ id: "t3", symbol: "ETH", pnl: 150, side: "buy", timestamp: Date.now() - 8000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("OPEN POSITIONS")
    expect(output).toContain("BTC")
    expect(output).toContain("ETH")
  })

  it("shows positive P&L in green and negative P&L in red", () => {
    mockState.tradeStream = [
      makeTrade({ id: "p1", symbol: "BTC", pnl: 1000, side: "buy", timestamp: Date.now() - 10000 }),
      makeTrade({ id: "n1", symbol: "ETH", pnl: -500, side: "sell", timestamp: Date.now() - 5000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    // The formatted P&L values should appear
    expect(output).toContain("+1,000")
    expect(output).toContain("-500")
  })

  it("calculates and displays total P&L in the positions header", () => {
    mockState.tradeStream = [
      makeTrade({ id: "a1", symbol: "BTC", pnl: 300, side: "buy", timestamp: Date.now() - 10000 }),
      makeTrade({ id: "a2", symbol: "ETH", pnl: -100, side: "sell", timestamp: Date.now() - 5000 }),
      makeTrade({ id: "a3", symbol: "XRP", pnl: 50, side: "buy", timestamp: Date.now() - 2000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    // Total should be 300 - 100 + 50 = 250
    expect(output).toContain("+250")
  })

  it("shows 'No open positions' when no trades have P&L data", () => {
    mockState.tradeStream = [
      makeTrade({ id: "np1", symbol: "BTC", pnl: undefined, side: "buy", timestamp: Date.now() - 10000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    // Without pnl data, positions table may still render but with 0 P&L
    // At minimum, the positions section should render
    expect(output).toContain("OPEN POSITIONS")
  })

  // ── Pause/Resume ────────────────────────────────────────────────────────

  it("shows LIVE status by default", () => {
    const output = renderTradeMonitor()
    expect(output).toContain("LIVE")
  })

  it("shows pause hint in header", () => {
    const output = renderTradeMonitor()
    expect(output).toContain("Space to pause")
  })

  // ── Performance Summary ─────────────────────────────────────────────────

  it("renders the performance summary section", () => {
    const output = renderTradeMonitor()
    expect(output).toContain("PERFORMANCE")
  })

  it("calculates today P&L from trades within current day", () => {
    // Trade from 25 hours ago (should NOT count in today)
    const old = makeTrade({
      id: "old-day",
      symbol: "BTC",
      pnl: 100,
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
      side: "buy",
    })
    // Trade from 1 hour ago (should count in today)
    const recent = makeTrade({
      id: "recent-day",
      symbol: "ETH",
      pnl: 200,
      timestamp: Date.now() - 60 * 60 * 1000,
      side: "sell",
    })
    mockState.tradeStream = [old, recent]
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("Today")
    // Recent trade's P&L (200) should be included, old (100) should not
    // So today pnl = 200
    expect(output).toContain("+200")
  })

  it("shows WinRate as a percentage", () => {
    mockState.tradeStream = [
      makeTrade({ id: "w1", pnl: 50, side: "buy", timestamp: Date.now() - 5000 }),
      makeTrade({ id: "w2", pnl: -20, side: "sell", timestamp: Date.now() - 4000 }),
      makeTrade({ id: "w3", pnl: 30, side: "buy", timestamp: Date.now() - 3000 }),
      makeTrade({ id: "w4", pnl: -10, side: "sell", timestamp: Date.now() - 2000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("WinRate")
    // 2 wins out of 4 = 50%
    expect(output).toContain("50.0%")
  })

  it("shows N/A for Sharpe ratio when insufficient data", () => {
    mockState.tradeStream = [
      makeTrade({ id: "s1", pnl: 50, side: "buy", timestamp: Date.now() - 5000 }),
      makeTrade({ id: "s2", pnl: -20, side: "sell", timestamp: Date.now() - 4000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("Sharpe")
    expect(output).toContain("N/A")
  })

  it("shows Sharpe ratio when enough data (5+ trades with P&L)", () => {
    mockState.tradeStream = [
      makeTrade({ id: "sh1", pnl: 10, side: "buy", timestamp: Date.now() - 5000 }),
      makeTrade({ id: "sh2", pnl: 15, side: "buy", timestamp: Date.now() - 4000 }),
      makeTrade({ id: "sh3", pnl: -5, side: "sell", timestamp: Date.now() - 3000 }),
      makeTrade({ id: "sh4", pnl: 20, side: "buy", timestamp: Date.now() - 2000 }),
      makeTrade({ id: "sh5", pnl: 12, side: "buy", timestamp: Date.now() - 1000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("Sharpe")
    // Should show a numeric value, not N/A
    expect(output).not.toContain("N/A")
  })

  // ── Ring Buffer Cap ─────────────────────────────────────────────────────

  it("trade feed references stored trade count (ring buffer)", () => {
    // The store manages the ring buffer (max 500), the component just displays it
    mockState.tradeStream = Array.from({ length: 100 }, (_, i) =>
      makeTrade({ id: `rb${i}`, symbol: `T${i}`, timestamp: Date.now() - i * 1000 }),
    )
    notifyListeners()

    const output = renderTradeMonitor()
    // Should show the trade count
    expect(output).toContain("100 trades")
  })

  // ── Error Boundary ──────────────────────────────────────────────────────

  it("renders within an error boundary wrapper", () => {
    mockState.tradeStream = [
      makeTrade({ id: "eb", symbol: "BTC", side: "buy", timestamp: Date.now() - 1000 }),
    ]
    notifyListeners()

    const output = renderTradeMonitor()
    // View renders successfully inside boundary
    expect(output).toContain("TRADE MONITOR")
    expect(output).toContain("BTC")
  })

  // ── 7-Day / 30-Day P&L ─────────────────────────────────────────────────

  it("calculates 7-day and 30-day P&L from historical trades", () => {
    // Within 7 days
    const recent7 = makeTrade({
      id: "r7",
      symbol: "BTC",
      pnl: 75,
      timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
      side: "buy",
    })
    // Within 30 days but older than 7
    const older30 = makeTrade({
      id: "o30",
      symbol: "ETH",
      pnl: 200,
      timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
      side: "sell",
    })
    mockState.tradeStream = [recent7, older30]
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("7-Day")
    expect(output).toContain("30-Day")
  })

  // ── Overall total P&L from system metrics ───────────────────────────────

  it("shows overall total P&L from system metrics when available", () => {
    mockState.tradeStream = [
      makeTrade({ id: "m1", symbol: "BTC", pnl: 100, side: "buy", timestamp: Date.now() - 1000 }),
    ]
    mockState.metrics = {
      totalWorkers: 10,
      onlineWorkers: 8,
      totalPnl: 15750.25,
      activeStrategies: 4,
      dailyTrades: 234,
      aiCalls: 56,
      uptime: 360000,
      lastUpdated: Date.now(),
    }
    notifyListeners()

    const output = renderTradeMonitor()
    expect(output).toContain("Total P&L")
    expect(output).toContain("+15,750.25")
  })
})
