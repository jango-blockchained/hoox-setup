/**
 * Shared test utilities for TUI components.
 *
 * Provides:
 *   - Type aliases matching TUI test expectations
 *   - Factory functions (makeWorker, makeLog, makeTrade)
 *   - Mock ErrorBoundary pass-through
 *
 * Centralises duplicated type definitions + factory functions
 * that were previously copy-pasted across test files.
 */

import type { ReactNode } from "react";

// ── Type Aliases ─────────────────────────────────────────────────────────────

export type WorkerStatus = "operational" | "degraded" | "down";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type ConnectionStatus =
  | "connected"
  | "polling"
  | "offline"
  | "reconnecting";
export type TradeSide = "buy" | "sell";

export interface TestWorkerInfo {
  id: string;
  name: string;
  status: WorkerStatus;
  uptime: number;
  cpu: number;
  memory: number;
  requests: number;
  durableObjectCount: number;
  edgeCount: number;
  version?: string;
  lastDeployed?: number;
}

export interface TestLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  workerId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface TestTrade {
  id: string;
  symbol: string;
  side: TradeSide;
  price: number;
  quantity: number;
  timestamp: number;
  exchange: string;
  pnl?: number;
}

// ── Factory Functions ────────────────────────────────────────────────────────

/** Create a test worker fixture with sensible defaults. */
export function makeWorker(
  overrides: Partial<TestWorkerInfo> = {}
): TestWorkerInfo {
  return {
    id: "test-worker-1",
    name: "trade-executor",
    status: "operational",
    uptime: 86400,
    cpu: 42.5,
    memory: 64,
    requests: 15000,
    durableObjectCount: 3,
    edgeCount: 12,
    version: "1.2.3",
    lastDeployed: Date.now() - 3600000,
    ...overrides,
  };
}

/** Create a test log entry with sensible defaults. */
export function makeLog(overrides: Partial<TestLogEntry> = {}): TestLogEntry {
  return {
    id: crypto.randomUUID?.() ?? "log-1",
    level: "info",
    message: "Test message",
    timestamp: Date.now(),
    workerId: undefined,
    source: undefined,
    ...overrides,
  };
}

/** Create a test trade with sensible defaults. */
export function makeTrade(overrides: Partial<TestTrade> = {}): TestTrade {
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
  };
}

// ── Mock ErrorBoundary ───────────────────────────────────────────────────────

/**
 * Pass-through ErrorBoundary for tests.
 *
 * Usage:
 *   mock.module("../shared/error-boundary", () => ({
 *     ErrorBoundary: MockErrorBoundary,
 *   }))
 */
export function MockErrorBoundary({
  children,
}: {
  viewName: string;
  children: ReactNode;
}): ReactNode {
  return children;
}
