# Hoox TUI

**Terminal Operations Center** for the Hoox algorithmic trading framework.  
A full-screen terminal dashboard built with [OpenTUI](https://github.com/anomalyco/opentui), [Bun](https://bun.sh), and [Zustand](https://zustand.docs.pmnd.rs/).

---

## Quick Start

```bash
# Install dependencies (from repo root)
bun install

# Launch the TUI in dev mode
cd packages/tui
bun run dev

# Build standalone binary
bun run build

# Run the built binary
bun run start
```

**Prerequisites:**
- [Bun](https://bun.sh) >= 1.1.0
- Terminal with 256-color support (xterm-256color, kitty, iTerm2, Windows Terminal)
- Minimum terminal size: 80 columns × 24 rows
- OpenTUI packages (`@opentui/core`, `@opentui/react`) — installed via `bun install`

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+1` | Dashboard view |
| `Ctrl+2` | Workers Overview |
| `Ctrl+3` | Worker Detail |
| `Ctrl+4` | Trade Monitor |
| `Ctrl+5` | Logs Viewer |
| `Ctrl+6` | Service Manager |
| `Ctrl+7` | Config Editor |
| `Ctrl+8` | Setup Wizard |
| `Ctrl+9` | Settings |
| `Ctrl+P` | Open Command Palette |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+R` | Refresh all data |
| `Ctrl+Q` | Quit (with confirmation) |
| `Esc` | Close palette / dismiss modal / go back |
| `↑` `↓` | Navigate within active view |
| `Tab` / `Shift+Tab` | Cycle focus between interactive elements |
| `Enter` | Select / confirm |
| `Space` | Toggle |
| `/` | Focus search (in searchable views) |

---

## Views

| View | Description |
|------|-------------|
| **Dashboard** | System health overview with service grid, recent alerts, and quick stats (P&L, trades, AI calls). |
| **Workers Overview** | List of all Cloudflare Workers with status, uptime, CPU, memory, and request metrics. |
| **Worker Detail** | Detailed view of a single worker — logs, metrics, Durable Objects, and deployment info. |
| **Trade Monitor** | Live trade stream with symbol, side, price, quantity, and P&L per trade. |
| **Logs Viewer** | Scrollable log stream with level filtering, worker selection, and full-text search. |
| **Service Manager** | Start, stop, restart, and deploy workers. View deployment history and rollback. |
| **Config Editor** | Edit Hoox configuration — exchange credentials, strategy parameters, risk limits. |
| **Setup Wizard** | Step-by-step guided setup for new Hoox installations (API keys, exchanges, wallet). |
| **Settings** | Display preferences, theme, notification toggles, and keyboard shortcut customization. |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **TUI Framework** | OpenTUI — `@opentui/core` + `@opentui/react` (JSX-based terminal rendering) |
| **Runtime** | [Bun](https://bun.sh) — fast all-in-one JS runtime |
| **State Management** | [Zustand](https://zustand.docs.pmnd.rs/) with Immer middleware |
| **Language** | TypeScript (strict mode) |
| **Testing** | Bun test runner (`bun test`) |
| **Build** | `bun build` — compiles to single executable |
| **Shared Module** | `@hoox/shared` — API client, SSE streaming, color tokens, formatters |

---

## Running Tests

```bash
# Run all tests
bun test

# Run only E2E smoke tests (requires OpenTUI installed)
bun test test/e2e/

# Run store tests
bun test test/stores/

# Run component tests
bun test test/components/
```

---

## Troubleshooting

### "Cannot find module @opentui/core"

OpenTUI packages must be installed. Ensure `bun install` completed successfully.  
If the packages are in a local path, verify the workspace configuration in the root `package.json`.

### API unreachable (OFFLINE in status bar)

The TUI polls the Hoox API backend. Check:
1. Is the Hoox API server running? (`bun run packages/api/src/index.ts`)
2. Is the `HOOX_API_URL` environment variable set correctly?
3. Are you on the correct network / VPN?

### Terminal too small

The TUI requires at least **80 columns × 24 rows**. Resize your terminal window.  
If you see garbled output, try: `export TERM=xterm-256color`

### Garbled screen after exit

If the alternate screen buffer isn't cleaned up, run: `reset` or `tput reset`

### Ctrl+Q not working

Some terminal emulators intercept Ctrl+Q for flow control (XON/XOFF).  
Disable flow control in your terminal settings, or use `stty -ixon` before launching.

### Build fails with missing dependencies

The `bun build` command bundles all TypeScript sources. If dependencies aren't resolved:
```bash
bun install
bun run build
```
Ensure `@hoox/shared` is linked as a workspace dependency.

### Colors look wrong

The TUI uses 256-color ANSI escape sequences. Ensure:
- `TERM=xterm-256color` (or `kitty`, `screen-256color`)
- Your terminal supports 256 colors
- No conflicting terminal color schemes

---

## Project Structure

```
packages/tui/
├── src/
│   ├── main.ts                    # Entry point — OpenTUI renderer setup
│   ├── app.tsx                    # Root component — layout, keyboard, crash recovery
│   ├── components/
│   │   ├── views/                 # 9 view components
│   │   │   ├── dashboard.tsx
│   │   │   ├── workers-overview.tsx
│   │   │   ├── worker-detail.tsx
│   │   │   ├── trade-monitor.tsx
│   │   │   ├── logs-viewer.tsx
│   │   │   ├── service-manager.tsx
│   │   │   ├── config-editor.tsx
│   │   │   ├── setup-wizard.tsx
│   │   │   └── settings.tsx
│   │   ├── shared/                # Reusable UI components
│   │   │   ├── animated-border.tsx
│   │   │   ├── command-palette.tsx
│   │   │   ├── crash-screen.tsx
│   │   │   ├── error-boundary.tsx
│   │   │   ├── keybinding-hint.tsx
│   │   │   └── status-dot.tsx
│   │   └── ui/                    # OpenTUI-UI wrappers
│   │       ├── connection-toasts.ts
│   │       ├── dialog.tsx
│   │       ├── select.tsx
│   │       └── toast.tsx
├── test/
│   ├── e2e/
│   │   └── smoke.test.ts          # E2E smoke test
│   ├── integration/
│   │   └── navigation.test.tsx    # Navigation integration tests
│   ├── components/
│   │   ├── layout.test.tsx        # Layout structure tests
│   │   └── shared.test.tsx        # Shared component tests
│   ├── stores/
│   │   ├── ui-store.test.ts       # UI store tests
│   │   ├── service-store.test.ts  # Service store tests
│   │   └── config-store.test.ts   # Config store tests
│   └── utils/
│       ├── colors.test.ts         # Color token tests
│       └── formatters.test.ts     # Formatter tests
├── package.json
└── README.md
```

---

## Design

Dark background (`#0D1117`), orange accent (`#E8780A`), squared edges.  
Follows the Hoox landing page design DNA. No CSS, no DOM, no browser APIs — pure terminal rendering via OpenTUI's JSX intrinsics (`<box>`, `<text>`, `<input>`, `<scrollbox>`).
