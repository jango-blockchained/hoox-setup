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
] as const;

export type ViewId = (typeof ALL_VIEWS)[number];

export const VIEW_LABELS: Record<ViewId, string> = {
  dashboard: "DASHBOARD",
  workers: "WORKERS",
  "worker-detail": "WORKER DETAIL",
  "trade-monitor": "TRADES",
  "logs-viewer": "LOGS",
  "service-manager": "SERVICES",
  "config-editor": "CONFIG",
  "setup-wizard": "SETUP",
  settings: "SETTINGS",
};

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
];

export function viewIndex(view: ViewId): number {
  return VIEW_ORDER.indexOf(view);
}

export type ModalType = "confirm" | "choice" | "loading" | "prompt";

export interface ModalState {
  type: ModalType;
  id: string;
  title?: string;
  message?: string;
  resolve?: (value: unknown) => void;
}

export interface ShortcutMap {
  [keys: string]: string;
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  "Ctrl+1": "DASHBOARD",
  "Ctrl+2": "WORKERS",
  "Ctrl+3": "WORKER DETAIL",
  "Ctrl+4": "TRADES",
  "Ctrl+5": "LOGS",
  "Ctrl+6": "SERVICES",
  "Ctrl+7": "CONFIG",
  "Ctrl+8": "SETUP",
  "Ctrl+9": "SETTINGS",
  "Ctrl+P": "COMMAND PALETTE",
  "Ctrl+B": "TOGGLE SIDEBAR",
  "Ctrl+R": "REFRESH DATA",
  "Ctrl+Q": "QUIT",
  Esc: "BACK / CLOSE",
  Tab: "NEXT FOCUS",
  "Shift+Tab": "PREVIOUS FOCUS",
  Space: "TOGGLE / PAUSE",
  "/": "SEARCH",
  Enter: "SELECT / CONFIRM",
};

// ─── CliBridge Types ─────────────────────────────────────────────

export interface CliResult<T = unknown> {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data: T | null;
  duration: number;
}

export type CliCommandStatus = "idle" | "running" | "success" | "failure";

export interface CliCommandState {
  tag: string;
  description: string;
  status: CliCommandStatus;
  result: CliResult | null;
  startedAt: number | null;
}
