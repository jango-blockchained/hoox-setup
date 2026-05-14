/**
 * TUI-specific types — Navigation, modals, keyboard shortcuts.
 */

/** All 9 primary views + command palette */
export const ALL_VIEWS = [
  "dashboard",
  "workers",
  "worker-detail",
  "trade-monitor",
  "logs-viewer",
  "service-manager",
  "config-editor",
  "setup-wizard",
  "settings",
] as const

export type ViewId = (typeof ALL_VIEWS)[number]

export const VIEW_LABELS: Record<ViewId, string> = {
  "dashboard": "Dashboard",
  "workers": "Workers",
  "worker-detail": "Worker Detail",
  "trade-monitor": "Trades",
  "logs-viewer": "Logs",
  "service-manager": "Services",
  "config-editor": "Config",
  "setup-wizard": "Setup",
  "settings": "Settings",
}

export const VIEW_ORDER: ViewId[] = [
  "dashboard",
  "workers",
  "worker-detail",
  "trade-monitor",
  "logs-viewer",
  "service-manager",
  "config-editor",
  "setup-wizard",
  "settings",
]

export function viewIndex(view: ViewId): number {
  return VIEW_ORDER.indexOf(view)
}

export type ModalType = "confirm" | "choice" | "loading" | "prompt"

export interface ModalState {
  type: ModalType
  id: string
  title?: string
  message?: string
  resolve?: (value: unknown) => void
}

export interface BoxLayout {
  flexDirection?: "row" | "column"
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around"
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch"
  width?: number | string
  height?: number | string
  flexGrow?: number
  padding?: number
  paddingTop?: number
  paddingBottom?: number
  paddingLeft?: number
  paddingRight?: number
  gap?: number
  border?: boolean
  borderStyle?: "single" | "rounded" | "double" | "bold"
  backgroundColor?: string
}

export interface ShortcutMap {
  [keys: string]: string
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  "Ctrl+1": "Dashboard",
  "Ctrl+2": "Workers",
  "Ctrl+3": "Worker Detail",
  "Ctrl+4": "Trades",
  "Ctrl+5": "Logs",
  "Ctrl+6": "Services",
  "Ctrl+7": "Config",
  "Ctrl+8": "Setup",
  "Ctrl+9": "Settings",
  "Ctrl+P": "Command Palette",
  "Ctrl+B": "Toggle Sidebar",
  "Ctrl+R": "Refresh Data",
  "Ctrl+Q": "Quit",
  "Esc": "Back / Close",
  "Tab": "Next Focus",
  "Shift+Tab": "Previous Focus",
  "Space": "Toggle / Pause",
  "/": "Search",
  "Enter": "Select / Confirm",
}
