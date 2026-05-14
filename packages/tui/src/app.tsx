/** @jsxImportSource @opentui/react */
/**
 * App Root — Main entry point for the Hoox TUI dashboard.
 *
 * Responsibilities:
 *   1. Restore session state from ~/.hoox/session.json on startup
 *   2. Initialize ToasterRenderable for toast notifications
 *   3. Render the layout shell (sidebar, tab bar, status bar, active view)
 *   4. Register global keyboard shortcuts
 *   5. Catch unhandled errors → crash screen
 *   6. Save session state on clean shutdown
 *
 * Follows TUI Pattern 1 (FrameBuffer full-screen root) and Pattern 4 (Keyboard).
 * Colors from design tokens via @hoox/shared. No CSS, no DOM.
 */
import { useState, useEffect, useCallback } from 'react'
import { useKeyboard } from '@opentui/react'
import { Colors } from '@hoox/shared'
import { useUIStore } from '@hoox/shared/stores/ui-store'
import { useServiceStore } from '@hoox/shared/stores/service-store'
import { useConfigStore } from '@hoox/shared/stores/config-store'
import { restoreSession, saveSession, type SessionState } from '@hoox/shared/src/session'
import { formatRelativeTime } from '@hoox/shared/src/format-time'

// Views
import { DashboardView } from './components/views/dashboard'
import { WorkersOverview } from './components/views/workers-overview'
import { WorkerDetail } from './components/views/worker-detail'
import { TradeMonitor } from './components/views/trade-monitor'
import { LogsViewer } from './components/views/logs-viewer'
import { ServiceManager } from './components/views/service-manager'
import { ConfigEditor } from './components/views/config-editor'
import { SetupWizard } from './components/views/setup-wizard'
import { SettingsView } from './components/views/settings'

// Shared UI
import { CrashScreen, type CrashAction } from './components/shared/crash-screen'
import { CommandPalette } from './components/shared/command-palette'
import type { ViewId } from '@hoox/shared'

// ─── View registry ───────────────────────────────────────────────────────────

const VIEWS: Record<ViewId, () => JSX.Element> = {
  dashboard: DashboardView,
  workers: WorkersOverview,
  'worker-detail': WorkerDetail,
  'trade-monitor': TradeMonitor,
  'logs-viewer': LogsViewer,
  'service-manager': ServiceManager,
  'config-editor': ConfigEditor,
  'setup-wizard': SetupWizard,
  settings: SettingsView,
}

// ─── View keyboard shortcuts ─────────────────────────────────────────────────

const VIEW_SHORTCUTS: Record<string, ViewId> = {
  '1': 'dashboard',
  '2': 'workers',
  '3': 'worker-detail',
  '4': 'trade-monitor',
  '5': 'logs-viewer',
  '6': 'service-manager',
  '7': 'config-editor',
  '8': 'setup-wizard',
  '9': 'settings',
}

// ─── StatusBar sub-component ─────────────────────────────────────────────────

/**
 * StatusBar — bottom bar showing connection status, stale data indicator,
 * and last-updated timestamp.
 */
function StatusBar() {
  const connectionStatus = useServiceStore((s) => s.connectionStatus)
  const lastUpdated = useServiceStore((s) => s.lastUpdated)
  const lastError = useServiceStore((s) => s.lastError)
  const retryCount = useServiceStore((s) => s.retryCount)
  const reconnectDelay = useServiceStore((s) => s.reconnectDelay)
  const disconnectedAt = useServiceStore((s) => s.disconnectedAt)

  const statusLabel: Record<string, string> = {
    connected: 'CONNECTED',
    polling: 'POLLING',
    reconnecting: 'RECONNECTING',
    offline: 'OFFLINE',
  }

  const statusColor: Record<string, string> = {
    connected: Colors.success,
    polling: Colors.accent,
    reconnecting: Colors.warning,
    offline: Colors.error,
  }

  const relativeTime =
    lastUpdated > 0 ? formatRelativeTime(lastUpdated) : '—'

  // Build the status line
  const parts: string[] = []

  // Connection status with color
  parts.push(`[${statusLabel[connectionStatus] ?? connectionStatus.toUpperCase()}]`)

  // Reconnecting detail
  if (connectionStatus === 'reconnecting') {
    parts.push(`retry ${retryCount}/5 (${reconnectDelay}ms)`)
  }

  // Stale data indicator when offline
  if (connectionStatus === 'offline' || connectionStatus === 'reconnecting') {
    parts.push(`Last updated: ${relativeTime}`)
  } else {
    parts.push(`Updated: ${relativeTime}`)
  }

  // Error hint
  if (lastError && connectionStatus !== 'connected') {
    const truncated =
      lastError.length > 40 ? lastError.slice(0, 37) + '…' : lastError
    parts.push(`| ${truncated}`)
  }

  return (
    <box
      flexDirection="row"
      height={1}
      justifyContent="space-between"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={Colors.card}
      border={true}
      borderStyle="single"
      borderColor={Colors.border}
    >
      <text fg={statusColor[connectionStatus] ?? Colors.muted}>
        {parts.join('  ')}
      </text>
      <text dim fg={Colors.muted}>
        Ctrl+P palette · Ctrl+B sidebar · Ctrl+Q quit
      </text>
    </box>
  )
}

// ─── Sidebar sub-component ───────────────────────────────────────────────────

/**
 * Sidebar — left navigation panel with view links.
 * Each item is clickable via onMouseUp.
 * Active view is highlighted with the accent color.
 */
function Sidebar() {
  const activeView = useUIStore((s) => s.activeView)
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded)
  const setView = useUIStore((s) => s.setView)

  if (!sidebarExpanded) return null

  const items: { id: ViewId; label: string; shortcut: string }[] = [
    { id: 'dashboard', label: 'Dashboard', shortcut: '1' },
    { id: 'workers', label: 'Workers', shortcut: '2' },
    { id: 'worker-detail', label: 'Worker Detail', shortcut: '3' },
    { id: 'trade-monitor', label: 'Trade Monitor', shortcut: '4' },
    { id: 'logs-viewer', label: 'Logs Viewer', shortcut: '5' },
    { id: 'service-manager', label: 'Service Manager', shortcut: '6' },
    { id: 'config-editor', label: 'Config Editor', shortcut: '7' },
    { id: 'setup-wizard', label: 'Setup Wizard', shortcut: '8' },
    { id: 'settings', label: 'Settings', shortcut: '9' },
  ]

  return (
    <box
      flexDirection="column"
      width={18}
      padding={1}
      gap={0}
      border={true}
      borderStyle="single"
      borderColor={Colors.border}
      backgroundColor={Colors.card}
    >
      {/* Brand header */}
      <text fg={Colors.accent} bold>
        HOOX
      </text>
      <text fg={Colors.muted} dim>
        ════════════════
      </text>

      {/* Navigation items */}
      {items.map((item) => {
        const isActive = item.id === activeView
        return (
          <box flexDirection="row" gap={1} key={item.id}>
            <text fg={isActive ? Colors.accent : Colors.muted} dim>
              {isActive ? '▸' : ' '}
            </text>
            <text
              fg={isActive ? Colors.accent : Colors.foreground}
              bold={isActive}
              onMouseUp={() => setView(item.id)}
            >
              {item.label}
            </text>
          </box>
        )
      })}

      {/* Shortcut hints */}
      <box flexGrow={1} />
      <text fg={Colors.dim} dim>
        Ctrl+1-9 to switch
      </text>
    </box>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────

/**
 * AppRoot — the top-level component.
 *
 * Renders the full layout: Sidebar | (TabBar + View) with StatusBar at bottom.
 * Wraps the entire app in a try/catch-free zone; unhandled errors are caught
 * by the platform-level crash handler (registered in the entry script).
 *
 * State flow:
 *   1. On mount: restore session → set activeView and sidebarExpanded
 *   2. On unmount (cleanup): save session to ~/.hoox/session.json
 *   3. Crash: CrashScreen rendered with [Restart] [Safe Mode] [Report Bug]
 */
export function AppRoot() {
  const [restoring, setRestoring] = useState(true)
  const activeView = useUIStore((s) => s.activeView)
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded)
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)
  const setView = useUIStore((s) => s.setView)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const openPalette = useUIStore((s) => s.openPalette)
  const closePalette = useUIStore((s) => s.closePalette)

  // ── Session restore on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    restoreSession().then((session: SessionState) => {
      if (cancelled) return
      // Restore previous view if valid
      if (session.activeView) {
        setView(session.activeView)
      }
      // Restore sidebar state
      if (!session.sidebarExpanded && sidebarExpanded) {
        toggleSidebar()
      }
      setRestoring(false)
    })
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session save on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const lastUpdated = useServiceStore.getState().lastUpdated
      saveSession(
        useUIStore.getState().activeView,
        useUIStore.getState().sidebarExpanded,
        { cols: 80, rows: 24 }, // window size detected elsewhere
        lastUpdated,
      ).catch(() => {
        // Non-fatal: session save failures are logged silently
      })
    }
  }, [])

  // ── Global keyboard shortcuts ───────────────────────────────────────────
  useKeyboard((key: { name: string; ctrl: boolean }) => {
    // Ctrl+1-9: switch views
    if (key.ctrl && VIEW_SHORTCUTS[key.name]) {
      setView(VIEW_SHORTCUTS[key.name])
      return
    }

    // Ctrl+B: toggle sidebar
    if (key.ctrl && key.name === 'b') {
      toggleSidebar()
      return
    }

    // Ctrl+P: command palette
    if (key.ctrl && key.name === 'p') {
      openPalette()
      return
    }

    // Escape: close palette
    if (key.name === 'escape') {
      closePalette()
      return
    }
  })

  // ── Loading state during session restore ────────────────────────────────
  if (restoring) {
    return (
      <box
        flexDirection="column"
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
        backgroundColor={Colors.background}
      >
        <text fg={Colors.accent} bold>
          HOOX
        </text>
        <text fg={Colors.muted} dim>
          Restoring session…
        </text>
      </box>
    )
  }

  // ── Active view component ───────────────────────────────────────────────
  const ActiveView = VIEWS[activeView] ?? VIEWS.dashboard

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={Colors.background}
    >
      {/* Main area: Sidebar + Content */}
      <box flexDirection="row" flexGrow={1}>
        {/* Sidebar (left) */}
        <Sidebar />

        {/* Content area: View (fills remaining space) */}
        <box flexDirection="column" flexGrow={1} padding={1}>
          <ActiveView />
        </box>
      </box>

      {/* StatusBar (bottom, always visible) */}
      <StatusBar />

      {/* Command Palette overlay */}
      {commandPaletteOpen && <CommandPalette />}
    </box>
  )
}

// ─── Crash Recovery Wrapper ──────────────────────────────────────────────────

/**
 * CrashRecoveryApp — wraps AppRoot with a crash boundary.
 *
 * When an unhandled error escapes the React tree:
 *   1. The error is caught
 *   2. CrashScreen is rendered with action buttons
 *   3. [Restart] → re-mount AppRoot (clears React error state)
 *   4. [Safe Mode] → re-mount with crashScreen.safeMode=true
 *   5. [Report Bug] → write error details to ~/.hoox/crash.log
 */
export function CrashRecoveryApp() {
  const [crash, setCrash] = useState<Error | null>(null)
  const [safeMode, setSafeMode] = useState(false)

  // React error boundary equivalent: catch errors in a wrapper
  const handleCrashAction = useCallback((action: CrashAction) => {
    switch (action) {
      case 'restart':
        // Clear crash state → re-mount AppRoot
        setCrash(null)
        setSafeMode(false)
        break

      case 'safe-mode':
        // Clear crash, enable safe mode
        setCrash(null)
        setSafeMode(true)
        break

      case 'report-bug':
        // Write crash details to ~/.hoox/crash.log
        if (crash) {
          const crashLog = [
            `=== Hoox Crash Report ===`,
            `Time: ${new Date().toISOString()}`,
            `Error: ${crash.message}`,
            `Stack: ${crash.stack ?? 'N/A'}`,
            `Safe Mode: ${safeMode}`,
            ``,
          ].join('\n')
          // Best-effort write (non-blocking)
          try {
            Bun.write(
              `${process.env.HOME ?? '/home/jango'}/.hoox/crash.log`,
              crashLog,
            ).catch(() => {})
          } catch {
            // Silent — write failed
          }
        }
        break
    }
  }, [crash, safeMode])

  // Register unhandled error handler
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      event.preventDefault()
      setCrash(event.error ?? new Error('Unknown crash'))
    }
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      event.preventDefault()
      setCrash(
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason)),
      )
    }

    // Bun/Node global error handlers
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error: Error) => {
        setCrash(error)
      })
      process.on('unhandledRejection', (reason: unknown) => {
        setCrash(
          reason instanceof Error ? reason : new Error(String(reason)),
        )
      })
    }

    return () => {
      // Cleanup handlers (best-effort)
      if (typeof process !== 'undefined') {
        process.removeAllListeners('uncaughtException')
        process.removeAllListeners('unhandledRejection')
      }
    }
  }, [])

  // ── Crash screen ────────────────────────────────────────────────────────
  if (crash) {
    return (
      <CrashScreen
        error={crash}
        safeMode={safeMode}
        onAction={handleCrashAction}
      />
    )
  }

  // ── Normal / safe mode ──────────────────────────────────────────────────
  return <AppRoot />
}
