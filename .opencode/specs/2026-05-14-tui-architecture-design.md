# TUI Architecture Design

> **Status:** Implemented ✓
> **Package:** `packages/tui/`
> **Runtime:** Bun + OpenTUI React
> **Created:** 2026-05-14 | **Last Updated:** 2026-05-18

---

## 1. Overview

The Hoox TUI is a full-screen terminal operations center for the Hoox algorithmic trading framework. It provides 9 keyboard-navigable views for monitoring and managing workers, trades, logs, configuration, and deployment.

Built with OpenTUI (React bindings), the TUI runs locally (not on Cloudflare) and communicates with the Hoox API via REST polling and SSE streaming. It uses Zustand for state management and the CLI bridge (`CliBridge`) for executing `hoox` CLI commands via `Bun.spawn`.

### Design DNA

- **Background:** `#0D1117` (dark terminal aesthetic)
- **Accent:** `#E8780A` (orange, matching brand)
- **Success:** `#00FF88` (green)
- **Error:** `#FF4444` (red)
- **Warning:** `#FFAA00` (amber)
- **Typography:** Monospace, uppercase headers, dimmed muted foreground
- **Layout:** Squared edges, minimal padding, HUD-style borders

## 2. Component Tree

```
CrashRecoveryApp                          ← Global error boundary + crash screen
  └── AppRoot                             ← Session restore, keyboard shortcuts
        ├── Sidebar                       ← Left nav panel (Ctrl+B toggle)
        ├── ActiveView                    ← Content area (switches on Ctrl+1-9)
        │     ├── DashboardView           ← View 1: system health overview
        │     ├── WorkersOverview         ← View 2: worker card grid
        │     ├── WorkerDetail            ← View 3: metrics, logs, DOs, config
        │     ├── TradeMonitor            ← View 4: live trades, positions, P&L
        │     ├── LogsViewer              ← View 5: filtered log stream
        │     ├── ServiceManager          ← View 6: deploy/restart/repair
        │     ├── ConfigEditor            ← View 7: TOML/JSON editor with validation
        │     ├── SetupWizard             ← View 8: 7-step onboarding wizard
        │     └── SettingsView            ← View 9: theme, data, notifications
        ├── StatusBar                     ← Connection status, last updated
        └── CommandPalette                ← Ctrl+P fuzzy search overlay
```

Each view is wrapped in its own `ErrorBoundary` component, so a crash in one view doesn't take down the entire TUI.

## 3. State Architecture — 3 Zustand Stores

All stores use Zustand with Immer middleware for immutable updates.

### 3.1 UI Store (`useUIStore`)

```typescript
interface UIState {
  activeView: ViewId; // Current view (dashboard | workers | ...)
  sidebarExpanded: boolean; // Sidebar toggle
  commandPaletteOpen: boolean; // Command palette visibility
  paletteSearch: string; // Current palette search query
}

interface UIActions {
  setView(id: ViewId): void;
  toggleSidebar(): void;
  openPalette(): void;
  closePalette(): void;
  setPaletteSearch(q: string): void;
}
```

### 3.2 Service Store (`useServiceStore`)

```typescript
interface ServiceState {
  workers: WorkerStatus[]; // Worker list with status
  trades: Trade[]; // Recent trades
  logs: LogEntry[]; // Log buffer
  metrics: SystemMetrics; // System-level metrics
  alerts: Alert[]; // Activity alerts (ring buffer, max 100)
  connectionStatus: ConnectionStatus; // connected | polling | reconnecting | offline
  lastUpdated: number; // Timestamp of last data
  lastError: string | null; // Last error message
  retryCount: number;
  reconnectDelay: number;
  disconnectedAt: number | null;
}

type ConnectionStatus = "connected" | "polling" | "reconnecting" | "offline";
```

### 3.3 Config Store (`useConfigStore`)

```typescript
interface ConfigState {
  theme: "dark";
  refreshIntervalMs: number;
  defaultView: ViewId;
  soundEnabled: boolean;
  notifications: NotificationPreferences; // Per-channel toggle
  activeExchanges: string[];
}
```

## 4. Data Flow

### REST Polling (Default)

```
Timer (every 5s by default)
  → useServiceStore.getState().fetchWorkers()
    → HTTP GET /api/workers
      → Parses JSON → Updates workers + metrics + connectionStatus
```

### SSE Streaming (When Available)

```
EventSource /api/live/trades
  → onMessage → useServiceStore.getState().pushTrade()
EventSource /api/live/logs
  → onMessage → useServiceStore.getState().pushLog()
```

### CliBridge (Fallback + Actions)

```
View button click
  → cliBridge.deployWorker(name)
    → Bun.spawn(["hoox", "deploy", "worker", name, "--json", "--yes"])
      → Parses JSON result
        → On success: alerts + store refresh
        → On failure: error alert
```

### Connection State Machine

```
CONNECTED ──(fetch fails)──→ POLLING ──(retry 5x)──→ RECONNECTING
  ↑                                                  ↓
  └────(success)──── CONNECTED ←──(max retries)── OFFLINE
```

The state machine uses exponential backoff (150ms, 300ms, 600ms, 1.2s, 2.4s) for reconnect attempts.

## 5. Keyboard System

### Global Shortcuts (app.tsx)

| Shortcut | Action               |
| -------- | -------------------- |
| Ctrl+1-9 | Switch to view       |
| Ctrl+B   | Toggle sidebar       |
| Ctrl+P   | Open command palette |
| Ctrl+R   | Refresh data         |
| Ctrl+Q   | Quit                 |

### Per-View Shortcuts

Each view registers its own keyboard handler via `useKeyboard()`. Views intercept keys when focused and respect the Escape key for cancel operations. The Command Palette (`Ctrl+P`) provides fuzzy-searchable access to all commands across all views.

## 6. View Registry

The view registry in `app.tsx` maps `ViewId` strings to component constructors:

```typescript
const VIEWS: Record<ViewId, () => JSX.Element> = {
  dashboard: DashboardView,
  workers: WorkersOverview,
  "worker-detail": WorkerDetail,
  "trade-monitor": TradeMonitor,
  "logs-viewer": LogsViewer,
  "service-manager": ServiceManager,
  "config-editor": ConfigEditor,
  "setup-wizard": SetupWizard,
  settings: SettingsView,
};
```

### View Quick Reference

| #   | View             | Purpose                                       | Data Source                  |
| --- | ---------------- | --------------------------------------------- | ---------------------------- |
| 1   | Dashboard        | System health, worker count, recent alerts    | REST polling + cliBridge     |
| 2   | Workers Overview | 2-column card grid, per-worker actions        | REST polling + cliBridge     |
| 3   | Worker Detail    | 4-pane: metrics, logs, DOs, config            | REST + SSE + cliBridge       |
| 4   | Trade Monitor    | Live trades table, P&L, open positions        | SSE streaming                |
| 5   | Logs Viewer      | Filtered log stream (level/worker/text)       | SSE + cliBridge fallback     |
| 6   | Service Manager  | Deploy/restart/repair with progress           | cliBridge                    |
| 7   | Config Editor    | File tree + syntax-highlighted editor         | Bun I/O + cliBridge validate |
| 8   | Setup Wizard     | 7-step onboarding (prereqs → deploy)          | cliBridge                    |
| 9   | Settings         | Theme, refresh rate, data mgmt, notifications | Config store + cliBridge     |

## 7. Layout System

The layout is a three-zone structure managed by OpenTUI's `flexDirection: "row"` and `flexDirection: "column"` box model:

```
┌──────────┬───────────────────────────────────────┐
│          │                                       │
│ SIDEBAR  │          ACTIVE VIEW                  │
│ (18 cols)│    (fills remaining space)            │
│ Ctrl+B   │                                       │
│ toggle   │                                       │
│          │                                       │
├──────────┴───────────────────────────────────────┤
│  STATUS BAR: [CONNECTED] Updated: 2s ago  ^P ^B ^Q│
└──────────────────────────────────────────────────┘
```

- **Sidebar:** 18-column fixed width, bordered, hides on toggle. Shows view labels with active indicator (▸).
- **Content:** `flexGrow: 1`, padded, renders the active view component.
- **StatusBar:** Single row, space-between layout. Connection indicator left, keybind hints right.

## 8. Error Handling

### Per-View Error Boundaries

Each view is wrapped in `<ErrorBoundary fallback={<ViewFallback />}>` which catches rendering errors and shows a graceful fallback with a "retry" button. The error boundary resets its internal state on retry.

### Global Crash Recovery (app.tsx)

`CrashRecoveryApp` wraps the entire `AppRoot` and handles:

- `uncaughtException`: Global process exceptions
- `unhandledRejection`: Unhandled promise rejections
- When caught, renders `CrashScreen` with three options:
  - **Restart** — Clear crash state, re-mount AppRoot
  - **Safe Mode** — Mount with reduced features
  - **Report Bug** — Write crash dump to `~/.hoox/crash.log`

## 9. Session Persistence

### Save/Restore Flow

```
On mount:
  restoreSession() → reads ~/.hoox/session.json
    → Sets activeView + sidebarExpanded from saved state
    → Shows "Restoring session…" loading screen

On unmount (clean shutdown):
  saveSession() → writes ~/.hoox/session.json
    → Stores activeView, sidebarExpanded, terminal dimensions, lastUpdated
```

The session file is a small JSON file (not the config file). Config is stored separately in `~/.hoox/config.json`.

## 10. CliBridge Service

The `CliBridge` (`src/services/cli-bridge.ts`) is a singleton that spawns the `hoox` CLI binary as a subprocess:

- **Binary resolution:** PATH → `node_modules/.bin/` → monorepo fallback (`packages/cli/bin/hoox.js`)
- **Execution:** `Bun.spawn()` with AbortController timeout (default 30s)
- **Structured output:** Uses `--json` flag for parseable results
- **Progress streaming:** stderr reader for deploy progress
- **12 convenience methods:** `deployAll`, `deployWorker`, `checkHealth`, `workerLogs`, `configShow`, `configValidate`, `monitorStatus`, `rebuild`, `repairWorker`, `checkSetup`, `abort`, `dispose`

## 11. File Structure

```
packages/tui/
├── src/
│   ├── app.tsx                          ← AppRoot + CrashRecoveryApp
│   ├── main.tsx                         ← OpenTUI renderer init
│   ├── types.ts                         ← ViewId shared types
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx              ← Left nav panel
│   │   │   └── statusbar.tsx            ← Connection + keybind bar
│   │   ├── views/                       ← 9 view components
│   │   │   ├── dashboard.tsx
│   │   │   ├── workers-overview.tsx
│   │   │   ├── worker-detail.tsx
│   │   │   ├── trade-monitor.tsx
│   │   │   ├── logs-viewer.tsx
│   │   │   ├── service-manager.tsx
│   │   │   ├── config-editor.tsx
│   │   │   ├── setup-wizard.tsx
│   │   │   └── settings.tsx
│   │   └── shared/                      ← Shared UI components
│   │       ├── command-palette.tsx
│   │       ├── crash-screen.tsx
│   │       └── error-boundary.tsx
│   ├── services/
│   │   └── cli-bridge.ts               ← CLI subprocess execution
│   ├── hooks/                           ← Custom hooks
│   └── stores/                          ← Zustand store wrappers
├── test/
│   └── e2e/
│       └── smoke.test.ts               ← E2E smoke tests
├── package.json
└── tsconfig.json
```

## 12. Key Design Decisions

1. **No CSS, no DOM** — OpenTUI renders to the terminal's alternate screen buffer using `FrameBuffer`. All styling is via JSX props: `fg`, `bg`, `bold`, `dim`, `border`.

2. **Color tokens from shared** — Colors are imported from `@jango-blockchained/hoox-shared` (not hardcoded) to stay consistent with the landing page and CLI branding.

3. **Three stores, not one** — Separate UI (navigation), Service (data), Config (preferences) stores prevent unnecessary re-renders and keep concerns isolated.

4. **Inline layout components, not separate files** — Sidebar and StatusBar are extracted into `components/layout/` since they're shared across all views. View-level components live in `components/views/`.

5. **View registry as config object** — The `VIEWS` record in `app.tsx` is a plain object, not JSX. This keeps view switching O(1) and avoids conditional rendering chains.

6. **CliBridge wraps, doesn't replace** — The CliBridge is a convenience layer over `Bun.spawn`. It doesn't replace the REST API or SSE streaming — it supplements them for actions that require the CLI (deploy, validate, check).

## 13. Related Documents

- **Context (domain):** `.opencode/context/tui/domain.md`
- **Context (standards):** `.opencode/context/tui/standards.md`
- **Context (patterns):** `.opencode/context/tui/patterns.md`
- **Spec (CliBridge):** `.opencode/specs/2026-05-17-tui-cli-bridge-design.md`
- **Spec (Setup Wizard):** `.opencode/specs/2026-05-18-setup-wizard-engine-design.md`
- **Architecture overview:** `.opencode/context/project-intelligence/concepts/architecture.md`
- **Tech stack:** `.opencode/context/project-intelligence/concepts/tech-stack.md`
