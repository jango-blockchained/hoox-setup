---
title: "Terminal UI (TUI)"
description: "Full-screen terminal operations center for Hoox"
---

# Terminal UI (TUI)

> **Interactive terminal dashboard** for managing and monitoring the Hoox algorithmic trading framework. A full-screen operations center with 9 views, keyboard-driven navigation, and real-time data streaming.

---

## What Is the Hoox TUI?

The Hoox TUI (Terminal User Interface) is a keyboard-driven, full-screen terminal dashboard that gives you real-time visibility into your entire Hoox trading infrastructure. Think of it as a command center for your edge — monitor workers, watch live trades, edit configuration, deploy updates, and more — all from your terminal.

**Key capabilities:**

- Live monitoring of all Cloudflare Workers (health, metrics, logs)
- Real-time trade feed with P&L tracking
- Stream log viewer with filtering and search
- Service management — deploy and restart workers
- Built-in config editor with syntax highlighting
- Setup wizard for new installations
- Keyboard-first navigation (Ctrl+1-9 to switch views)

---

## Prerequisites

| Requirement      | Details                                                             |
| ---------------- | ------------------------------------------------------------------- |
| **Bun**          | >= 1.1.0 — [Install Bun](https://bun.sh)                            |
| **Terminal**     | 256-color support (xterm-256color, kitty, iTerm2, Windows Terminal) |
| **Minimum size** | 80 columns × 24 rows                                                |
| **Dependencies** | Installed via `bun install` from repo root                          |

---

## Launching the TUI

There are several ways to launch the TUI:

```bash
# From the repository root — via launcher script
./hoox-tui

# Via the hoox CLI
hoox tui

# Directly via Bun
cd packages/tui && bun run dev

# Or from any directory with the TUI package
bun run packages/tui/src/main.tsx
```

> **Note:** The first time you launch, you may see the **Setup Wizard** if no configuration exists. Follow the 6-step onboarding to connect your Hoox instance.

### Command-Line Flags

When using `hoox tui`:

| Flag             | Description                                  |
| ---------------- | -------------------------------------------- |
| `--fps <number>` | Override the target frame rate (default: 30) |
| `--no-mouse`     | Disable mouse support                        |

---

## Keyboard Shortcuts

The TUI is designed for keyboard-first navigation. All shortcuts are active from any view:

| Key                 | Action                                       |
| ------------------- | -------------------------------------------- |
| `Ctrl+1`            | **Dashboard** — System health overview       |
| `Ctrl+2`            | **Workers Overview** — All worker cards      |
| `Ctrl+3`            | **Worker Detail** — Deep-dive into a worker  |
| `Ctrl+4`            | **Trade Monitor** — Live trade feed          |
| `Ctrl+5`            | **Logs Viewer** — Streaming logs             |
| `Ctrl+6`            | **Service Manager** — Deploy/restart         |
| `Ctrl+7`            | **Config Editor** — Edit configuration files |
| `Ctrl+8`            | **Setup Wizard** — First-run onboarding      |
| `Ctrl+9`            | **Settings** — Preferences                   |
| `Ctrl+P`            | Open Command Palette (fuzzy search)          |
| `Ctrl+B`            | Toggle sidebar visibility                    |
| `Ctrl+R`            | Refresh all data                             |
| `Ctrl+Q`            | Quit (with confirmation dialog)              |
| `Esc`               | Close palette / dismiss modal / go back      |
| `↑` `↓`             | Navigate within the active view              |
| `Tab` / `Shift+Tab` | Cycle focus between interactive elements     |
| `Enter`             | Select / confirm                             |
| `Space`             | Toggle (checkboxes, switches)                |
| `/`                 | Focus search (in searchable views)           |

> **Tip:** If `Ctrl+Q` doesn't work, your terminal may intercept it for flow control (XON/XOFF). Run `stty -ixon` before launching, or disable software flow control in your terminal settings.

---

## View Tour

### 1. Dashboard (`Ctrl+1`)

The system health overview — your at-a-glance operations center.

- **Service Health Grid** — Color-coded status of all workers (operational/degraded/down)
- **Alerts Panel** — Recent system alerts and warnings
- **Quick Stats** — P&L, active strategies, daily trades, AI calls
- **Connection Status** — API connection health indicator in the status bar

### 2. Workers Overview (`Ctrl+2`)

A 2-column card grid showing all Cloudflare Workers.

- **Per-Worker Cards** — Name, status, uptime, CPU, memory, request count
- **Durable Objects** — Active DO instance counts
- **Edge Locations** — Deployment distribution
- Press `Enter` on a worker to jump to **Worker Detail**

### 3. Worker Detail (`Ctrl+3`)

Deep-dive into a single worker's operations with a 2x2 pane layout:

| Pane                | Content                                               |
| ------------------- | ----------------------------------------------------- |
| **Metrics**         | CPU, memory, request rate, error rate over time       |
| **Live Logs**       | Auto-scrolling log stream (press `p` to pause/resume) |
| **Durable Objects** | Active DO instances and their states                  |
| **Config Preview**  | Worker configuration snapshot                         |

### 4. Trade Monitor (`Ctrl+4`)

Live trade execution monitoring with three sections:

- **Trade Feed** — Real-time stream of executed trades (symbol, side, price, quantity, P&L)
  - Press `p` to pause/resume the feed
- **Open Positions** — Current positions grouped by symbol with unrealized P&L
- **Performance Summary** — Today / 7-Day / 30-Day P&L, Win Rate, Sharpe ratio

### 5. Logs Viewer (`Ctrl+5`)

Split-panel log viewer for filtering and searching through live logs:

- **Filter Panel** (left) — Level checkboxes (INFO, WARN, ERROR), worker selection, text search input
- **Log Stream** (right) — Scrolling color-coded log entries
  - `INFO` — White / `WARN` — Yellow / `ERROR` — Red
  - Auto-scrolls by default, scroll up to pause

### 6. Service Manager (`Ctrl+6`)

Manage worker deployments and operations:

- **Worker Controls** — Deploy, restart, and view deployment history per worker
- **Bulk Actions** — Deploy all / restart all
- **Edge Location Map** — Interactive map of 16 Cloudflare PoPs (SFO, LAX, LHR, NRT, SIN, etc.) with clickable locations
- **Confirmation Dialogs** — All destructive actions require confirmation

### 7. Config Editor (`Ctrl+7`)

A full-featured code editor for Hoox configuration files:

- **File Tree** (left) — Browse configuration files
- **Code Editor** (right) — Syntax-highlighted editing with line numbers
  - Supports **TOML** and **JSON** syntax highlighting
  - Live validation (bracket matching, quote balancing, JSON error extraction)
  - Code formatting (JSON prettify, TOML whitespace normalization)
- **Unsaved Changes** — Visual indicators for modified files
- **Save** — `Ctrl+S` or use the save button

### 8. Setup Wizard (`Ctrl+8`)

A 6-step guided onboarding flow for new Hoox installations:

| Step                 | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| **1. API Keys**      | Enter your Cloudflare API credentials                          |
| **2. Exchanges**     | Configure exchange API keys (Binance, MEXC, Bybit) — optional  |
| **3. AI Providers**  | Set up AI provider keys (OpenAI, Anthropic, Google) — optional |
| **4. Strategies**    | Define initial trading strategies — optional                   |
| **5. Notifications** | Configure Telegram bot for notifications — optional            |
| **6. Deploy**        | Summary review and deployment kickoff                          |

Each step validates input in real-time (API key masking, email/URL format checks). Steps 2-6 can be skipped and configured later.

### 9. Settings (`Ctrl+9`)

Four-column settings panel:

| Column              | Options                            |
| ------------------- | ---------------------------------- |
| **Theme**           | Dark / Light mode toggle           |
| **Notifications**   | Notification channel configuration |
| **Keyboard**        | Shortcut reference table           |
| **Data Management** | Cache clearing, session reset      |

### Command Palette (`Ctrl+P`)

Fuzzy-searchable overlay that provides quick access to all views and actions:

- Start typing to filter (e.g., "trade", "worker", "settings")
- `Enter` to navigate to the selected item
- `Esc` to dismiss

---

## Status Bar

The status bar at the bottom of the screen shows real-time system information:

```
● Connected  │  9/9 Workers Online  │  +$1,234 P&L  │  14:30:25 UTC  │  ^P Palette  ^Q Quit
```

| Element            | Description                                    |
| ------------------ | ---------------------------------------------- |
| **Connection Dot** | `●` Connected / `◉` Reconnecting / `○` Offline |
| **Worker Status**  | Online / total workers count                   |
| **P&L**            | Current session P&L (if available)             |
| **Clock**          | Current UTC time                               |
| **Keybind Hints**  | Context-sensitive shortcut reminders           |

---

## Tips & Tricks

- **Quick view switching**: Memorize `Ctrl+1` through `Ctrl+9` — they're the fastest way to navigate
- **Command Palette**: `Ctrl+P` is faster than hunting through views for actions
- **Pause log feeds**: In Trade Monitor or Logs Viewer, press `p` or scroll up to pause auto-scroll
- **Sidebar toggle**: `Ctrl+B` hides the sidebar for more content space on small terminals
- **Refresh all**: `Ctrl+R` force-refreshes all data from the API
- **Config Editor**: Use `Ctrl+S` to save files, `Ctrl+Z` is not supported (use the command palette instead)

---

## Troubleshooting

### "Cannot find module @opentui/core"

OpenTUI packages must be installed. Ensure `bun install` completed successfully.

### API unreachable ("OFFLINE" in status bar)

The TUI polls the Hoox API backend. Check:

1. Is the Hoox API server running? (`hoox dev start`)
2. Is the `HOOX_API_URL` environment variable set correctly?
3. Are you on the correct network / VPN?

### Terminal too small

The TUI requires at least **80 columns × 24 rows**. Resize your terminal window. If you see garbled output, try:

```bash
export TERM=xterm-256color
```

### Garbled screen after exit

If the alternate screen buffer isn't cleaned up properly, run:

```bash
reset
# or
tput reset
```

### Colors look wrong

Ensure your terminal supports 256 colors:

```bash
# Check current TERM setting
echo $TERM   # Should be xterm-256color, kitty, screen-256color, etc.

# Set if needed
export TERM=xterm-256color
```

### TUI won't start

Try these steps:

1. Verify Bun is installed: `bun --version`
2. Install dependencies: `bun install`
3. Build the TUI: `cd packages/tui && bun run build`
4. Run the built version: `bun run start`

---

## Configuration

The TUI stores its configuration at `~/.hoox/config.json`. This file is auto-managed — you typically don't need to edit it manually.

**Session persistence:** The TUI saves and restores:

- Active view (returns to your last-used view)
- Sidebar state (open/closed)
- Terminal dimensions

These are stored in `~/.hoox/session.json`.

---

## Related

- [Local Development](../guides/local-development.md) — Run all workers locally
- [CLI Commands](../reference/cli-commands.md) — Full command reference
- [DevOps Manual](../devops/home.md) — Operations and infrastructure
