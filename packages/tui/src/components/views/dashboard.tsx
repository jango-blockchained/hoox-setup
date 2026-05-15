/** @jsxImportSource @opentui/react */
/**
 * Dashboard View — System health overview with service grid, alerts, and quick stats.
 *
 * Layout (vertical):
 *   1. Header: "DASHBOARD" title + animated connection status dot
 *   2. ServiceHealthGrid: worker cards with name + status indicator
 *   3. AlertsPanel: scrollable box with recent alerts, newest first
 *   4. QuickStatsRow: 4 metric cards with large numbers
 *
 * Follows Pattern 1 (View Composition) and Pattern 2 (Store Subscription).
 * Colors from design tokens via @jango-blockchained/hoox-shared. No CSS, no DOM.
 */
import { useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { Colors } from "@jango-blockchained/hoox-shared"
import { useServiceStore } from "@jango-blockchained/hoox-shared/stores/service-store"
import { ErrorBoundary } from "../shared/error-boundary"
import { StatusDot } from "../shared/status-dot"
import type { Alert, AlertSeverity } from "@jango-blockchained/hoox-shared"

// ─── Constants ────────────────────────────────────────────────────────────────

/** Severity-based color keys for alert text */
const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  info: Colors.info,
  warning: Colors.warning,
  error: Colors.error,
  critical: Colors.error, // critical gets same red as error, but bold
}

/** Severity label prefix */
const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "INFO",
  warning: "WARN",
  error: "ERR",
  critical: "CRIT",
}

/** Maximum alerts shown in the panel */
const MAX_VISIBLE_ALERTS = 50

// ─── Number Formatter (Bebas-style large numbers) ────────────────────────────

/**
 * Format a number for the stats cards.
 * - ≥1M: "1.2M"
 * - ≥1K: "12.3K"
 * - else: comma-separated integer
 * - P&L gets +/- prefix
 */
function formatStatNumber(value: number, isPnl = false): string {
  if (isPnl) {
    const sign = value >= 0 ? "+" : ""
    const abs = Math.abs(value)
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`
    return `${sign}${abs.toFixed(2)}`
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("en-US")
}

/**
 * Format a timestamp (ms) to HH:MM:SS for alert display.
 */
function formatTime(ts: number): string {
  const d = new Date(ts)
  return [
    d.getHours().toString().padStart(2, "0"),
    d.getMinutes().toString().padStart(2, "0"),
    d.getSeconds().toString().padStart(2, "0"),
  ].join(":")
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/**
 * DashboardHeader — view title with animated connection status.
 */
function DashboardHeader() {
  const connectionStatus = useServiceStore((s) => s.connectionStatus)

  const statusLabel: Record<string, string> = {
    connected: "CONNECTED",
    polling: "POLLING",
    reconnecting: "RECONNECTING",
    offline: "OFFLINE",
  }

  return (
    <box flexDirection="row" gap={2} paddingBottom={1}>
      <text fg={Colors.accent} bold>
        DASHBOARD
      </text>
      <box flexDirection="row" gap={1}>
        <StatusDot
          status={
            connectionStatus === "connected"
              ? "operational"
              : connectionStatus === "polling"
                ? "degraded"
                : "down"
          }
          pulse={connectionStatus === "connected"}
        />
        <text dim fg={Colors.muted}>
          {statusLabel[connectionStatus] ?? connectionStatus.toUpperCase()}
        </text>
      </box>
    </box>
  )
}

/**
 * ServiceHealthGrid — displays all workers as a grid of status cards.
 * Each card shows: [█ ▌ ░] WORKER_NAME
 * Limited to first 10 workers (fits the dashboard layout).
 */
function ServiceHealthGrid() {
  const workers = useServiceStore((s) => s.workers)

  // Show first 10 workers (dashboard is an overview)
  const visibleWorkers = useMemo(() => workers.slice(0, 10), [workers])

  if (workers.length === 0) {
    return (
      <box flexDirection="column" paddingY={1}>
        <text fg={Colors.muted} dim>
          No workers connected — waiting for data…
        </text>
      </box>
    )
  }

  return (
    <box flexDirection="column" gap={0}>
      {/* Section label */}
      <text fg={Colors.foreground} bold dim>
        SERVICE HEALTH
      </text>

      {/* 2 rows × 5 columns grid */}
      <box
        flexDirection="row"
        flexWrap="wrap"
        gap={1}
        paddingTop={1}
        paddingBottom={1}
      >
        {visibleWorkers.map((worker, i) => (
          <box
            key={worker.id}
            flexDirection="row"
            width={28}
            gap={1}
            paddingLeft={1}
            paddingRight={1}
          >
            <StatusDot status={worker.status} />
            <text fg={Colors.foreground}>{worker.name}</text>
            {/* Fill remaining space with muted dots for alignment */}
            {i >= visibleWorkers.length && (
              <text fg={Colors.dim} dim>
                —
              </text>
            )}
          </box>
        ))}
      </box>

      {/* Fill empty slots in grid to maintain 10-card layout */}
      {visibleWorkers.length < 10 && (
        <box flexDirection="row" flexWrap="wrap" gap={1}>
          {Array.from({ length: 10 - visibleWorkers.length }).map((_, i) => (
            <box
              key={`empty-${i}`}
              flexDirection="row"
              width={28}
              gap={1}
              paddingLeft={1}
              paddingRight={1}
            >
              <text fg={Colors.dim} dim>
                —
              </text>
              <text fg={Colors.dim} dim>
                —
              </text>
            </box>
          ))}
        </box>
      )}
    </box>
  )
}

/**
 * AlertsPanel — scrollable list of recent alerts, newest first.
 * Each alert row shows: [SEV] HH:MM:SS — message
 * Color-coded by severity. Scrollable with ↑↓ keys.
 */
function AlertsPanel() {
  const alerts = useServiceStore((s) => s.alerts)
  const [scrollOffset, setScrollOffset] = useState(0)

  // Newest first, limited
  const sortedAlerts = useMemo(() => {
    return [...alerts]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_VISIBLE_ALERTS)
  }, [alerts])

  // Keyboard: scroll through alerts
  useKeyboard((key) => {
    if (key.name === "up") {
      setScrollOffset((o) => Math.max(0, o - 1))
    } else if (key.name === "down") {
      setScrollOffset((o) => Math.min(Math.max(0, sortedAlerts.length - 1), o + 1))
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Section label */}
      <text fg={Colors.foreground} bold dim>
        ALERTS
      </text>

      {sortedAlerts.length === 0 ? (
        <text fg={Colors.muted} dim paddingTop={1}>
          No alerts
        </text>
      ) : (
        <scrollbox
          width="100%"
          flexGrow={1}
          height={8}
          border={true}
          borderStyle="single"
          borderColor={Colors.border}
          paddingTop={0}
        >
          {sortedAlerts.map((alert, i) => {
            const color = SEVERITY_COLOR[alert.severity]
            const label = SEVERITY_LABEL[alert.severity]
            const isCritical = alert.severity === "critical"
            const isSelected = i === scrollOffset

            return (
              <box
                key={alert.id}
                flexDirection="row"
                gap={1}
                backgroundColor={isSelected ? Colors.card : undefined}
              >
                {/* Severity badge */}
                <text fg={color} bold={isCritical} dim={!isCritical}>
                  [{label}]
                </text>

                {/* Timestamp */}
                <text fg={Colors.muted} dim>
                  {formatTime(alert.timestamp)}
                </text>

                {/* Divider */}
                <text fg={Colors.dim} dim>
                  —
                </text>

                {/* Message */}
                <text
                  fg={color}
                  bold={isCritical}
                  dim={alert.acknowledged}
                >
                  {alert.message.length > 60
                    ? alert.message.slice(0, 57) + "…"
                    : alert.message}
                </text>

                {/* Acknowledged marker */}
                {alert.acknowledged && (
                  <text fg={Colors.dim} dim>
                    ✓
                  </text>
                )}
              </box>
            )
          })}
        </scrollbox>
      )}

      {/* Scroll hint */}
      {sortedAlerts.length > 0 && (
        <text fg={Colors.dim} dim>
          ↑↓ scroll · {scrollOffset + 1}/{sortedAlerts.length}
        </text>
      )}
    </box>
  )
}

/**
 * MetricCard — a single stat card with label and large formatted number.
 */
function MetricCard({
  label,
  value,
  color,
  isPnl = false,
}: {
  label: string
  value: number
  color: string
  isPnl?: boolean
}) {
  return (
    <box
      flexDirection="column"
      width={22}
      border={true}
      borderStyle="single"
      borderColor={Colors.border}
      backgroundColor={Colors.card}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Label (dim, small) */}
      <text fg={Colors.muted} dim>
        {label}
      </text>

      {/* Value (large, colored) */}
      <text fg={color} bold>
        {formatStatNumber(value, isPnl)}
      </text>
    </box>
  )
}

/**
 * QuickStatsRow — row of 4 metric cards from SystemMetrics.
 * P&L, Active Strategies, Daily Trades, AI Calls.
 */
function QuickStatsRow() {
  const metrics = useServiceStore((s) => s.metrics)

  // Default values when metrics is null/unavailable
  const totalPnl = metrics?.totalPnl ?? 0
  const activeStrategies = metrics?.activeStrategies ?? 0
  const dailyTrades = metrics?.dailyTrades ?? 0
  const aiCalls = metrics?.aiCalls ?? 0

  return (
    <box flexDirection="column" gap={0}>
      <text fg={Colors.foreground} bold dim>
        QUICK STATS
      </text>

      <box flexDirection="row" gap={1} paddingTop={1}>
        <MetricCard
          label="P&L"
          value={totalPnl}
          color={totalPnl >= 0 ? Colors.success : Colors.error}
          isPnl
        />
        <MetricCard
          label="Active Strategies"
          value={activeStrategies}
          color={Colors.accent}
        />
        <MetricCard
          label="Daily Trades"
          value={dailyTrades}
          color={Colors.info}
        />
        <MetricCard
          label="AI Calls"
          value={aiCalls}
          color={Colors.accent}
        />
      </box>

      {/* Empty state when metrics unavailable */}
      {metrics === null && (
        <text fg={Colors.muted} dim paddingTop={1}>
          Waiting for metrics data…
        </text>
      )}
    </box>
  )
}

// ─── Main View ───────────────────────────────────────────────────────────────

/**
 * DashboardView — system health overview.
 *
 * Composes: Header → ServiceHealthGrid → AlertsPanel → QuickStatsRow
 * Wrapped in an ErrorBoundary for crash recovery.
 *
 * View subscribes to service-store (workers, alerts, metrics, connectionStatus)
 * and re-renders on data changes via Zustand selectors.
 */
export function DashboardView() {
  return (
    <ErrorBoundary viewName="Dashboard">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        {/* 1. Header: title + connection status */}
        <DashboardHeader />

        {/* Divider */}
        <text fg={Colors.border} dim>
          {""}
          {"─".repeat(80)}
        </text>

        {/* 2. Service health grid */}
        <ServiceHealthGrid />

        {/* 3. Alerts panel */}
        <AlertsPanel />

        {/* 4. Quick stats row */}
        <QuickStatsRow />
      </box>
    </ErrorBoundary>
  )
}
