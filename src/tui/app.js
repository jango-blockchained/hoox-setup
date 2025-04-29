#!/usr/bin/env node

/**
 * Cryptolinx Worker Control System TUI
 *
 * A terminal user interface for managing the Cryptolinx trading system workers.
 * This TUI provides monitoring and control capabilities for all worker services
 * in the Cloudflare Workers-based trading system.
 */

import blessed from "blessed";
import { WorkerService } from "./services/WorkerService.js";
import { spawn, exec } from "child_process";
import { promisify } from "util";

// Create the actual promisified exec function
const execPromise = promisify(exec);

// --- Color Theme ---
const THEME = {
  bg: "black",
  fg: "white",
  accent: "blue",
  success: "green",
  warning: "yellow",
  error: "red",
  inactive: "gray",
  border: "white",
  selected: "blue",
};

// --- Blessed TUI Setup ---
const screen = blessed.screen({
  smartCSR: true,
  title: "Cryptolinx Worker Control System",
  fullUnicode: true,
});

// --- Worker State ---
let workers = {
  d1: {
    name: "D1 Worker",
    status: "stopped",
    port: 8787,
    extraArgs: "--local",
  },
  trade: { name: "Trade Worker", status: "stopped", port: 8788, extraArgs: "" },
  webhook: {
    name: "Webhook Receiver",
    status: "stopped",
    port: 8789,
    extraArgs: "",
  },
  telegram: {
    name: "Telegram Worker",
    status: "stopped",
    port: 8790,
    extraArgs: "",
  },
  "home-assistant": {
    name: "Home Assistant",
    status: "stopped",
    port: 8791,
    extraArgs: "",
  },
  "web3-wallet": {
    name: "Web3 Wallet",
    status: "stopped",
    port: 8792,
    extraArgs: "",
  },
};
let selectedWorkerId = "d1";
let logs = {}; // Store logs { workerId: [log lines] }
let statusMessage = "";

// --- Service Initialization ---
const setWorkersState = (newWorkers) => {
  if (typeof newWorkers === "function") {
    workers = newWorkers(workers);
  } else {
    workers = newWorkers;
  }
  updateStatusList();
};

const setLogsState = (newLogs) => {
  if (typeof newLogs === "function") {
    logs = newLogs(logs);
  } else {
    logs = newLogs;
  }
  updateLogView();
};

const setStatusMessageState = (msg) => {
  statusMessage = msg;
  updateStatusBar();
};

const workerService = new WorkerService(
  workers,
  setWorkersState,
  setLogsState,
  setStatusMessageState,
  spawn,
  execPromise
);

// --- UI Elements ---

// Header
const _header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: 3,
  tags: true,
  padding: { left: 1, right: 1 },
  content: "{bold}Cryptolinx Worker Control System{/} \nMode: {yellow-fg}Local Development{/}",
  style: {
    fg: THEME.accent,
    bg: THEME.bg,
  },
});

// Main container (below header, above status bar)
const mainContainer = blessed.box({
  parent: screen,
  top: 3,
  left: 0,
  width: "100%",
  height: "100%-4", // Full height minus header and status bar
  style: {
    bg: THEME.bg,
  },
});

// Left panel - Worker Status
const statusPane = blessed.box({
  parent: mainContainer,
  top: 0,
  left: 0,
  width: "25%",
  height: "100%",
  label: " Workers ",
  border: {
    type: "line",
    bg: THEME.bg,
    fg: THEME.border,
  },
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
    border: {
      fg: THEME.border,
      bg: THEME.bg,
    },
  },
});

const statusList = blessed.list({
  parent: statusPane,
  top: 0,
  left: 0,
  width: "100%-2", // Account for borders
  height: "100%-2", // Account for borders
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  padding: { left: 1, right: 0 },
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
    selected: {
      bg: THEME.selected,
      fg: "white",
      bold: true,
    },
    item: {
      fg: THEME.fg,
    },
  },
});

// Middle panel - Worker Details & Controls
const detailsPane = blessed.box({
  parent: mainContainer,
  top: 0,
  left: "25%",
  width: "45%",
  height: "100%",
  label: " Worker Details ",
  border: {
    type: "line",
    bg: THEME.bg,
    fg: THEME.border,
  },
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
    border: {
      fg: THEME.border,
      bg: THEME.bg,
    },
  },
});

const controlBox = blessed.box({
  parent: detailsPane,
  top: 0,
  left: 0,
  width: "100%-2", // Account for borders
  height: 5,
  padding: { left: 1, top: 1, right: 1 },
  tags: true,
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
  },
});

const _commandBox = blessed.box({
  parent: detailsPane,
  top: 5,
  left: 0,
  width: "100%-2", // Account for borders
  height: 3,
  padding: { left: 1 },
  tags: true,
  content: "{bold}Commands:{/} [s]tart [k]ill [r]estart [↑/↓] navigate [q]uit",
  style: {
    bg: THEME.bg,
    fg: THEME.inactive,
  },
});

const logBox = blessed.box({
  parent: detailsPane,
  top: 8,
  left: 0,
  width: "100%-2", // Account for borders
  height: "100%-9", // Account for controls and border
  label: " Logs ",
  border: {
    type: "line",
    bg: THEME.bg,
    fg: THEME.border,
  },
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
    border: {
      fg: THEME.border,
      bg: THEME.bg,
    },
  },
});

const logView = blessed.log({
  parent: logBox,
  top: 0,
  left: 0,
  width: "100%-2", // Account for borders
  height: "100%-2", // Account for borders
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: "│",
    style: {
      bg: THEME.bg,
      fg: THEME.accent,
    },
    track: {
      bg: THEME.bg,
      fg: THEME.inactive,
    },
  },
  mouse: true,
  keys: true,
  vi: true,
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
  },
});

// Right panel - System Info & Actions
const infoPane = blessed.box({
  parent: mainContainer,
  top: 0,
  left: "70%",
  width: "30%",
  height: "100%",
  label: " System Info ",
  border: {
    type: "line",
    bg: THEME.bg,
    fg: THEME.border,
  },
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
    border: {
      fg: THEME.border,
      bg: THEME.bg,
    },
  },
});

const systemInfo = blessed.box({
  parent: infoPane,
  top: 0,
  left: 0,
  width: "100%-2", // Account for borders
  height: "30%",
  padding: { left: 1, top: 1 },
  tags: true,
  content: "Loading system info...",
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
  },
});

const actionsBox = blessed.box({
  parent: infoPane,
  top: "30%",
  left: 0,
  width: "100%-2", // Account for borders
  height: "70%",
  label: " Global Actions ",
  border: {
    type: "line",
    bg: THEME.bg,
    fg: THEME.border,
  },
  padding: { left: 1, top: 1 },
  tags: true,
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
    border: {
      fg: THEME.border,
      bg: THEME.bg,
    },
  },
});

const _actionsText = blessed.text({
  parent: actionsBox,
  content:
    "{bold}Global Actions{/}\n\n[Ctrl+S] Start All\n[Ctrl+K] Stop All\n[Ctrl+R] Restart All",
  tags: true,
  style: {
    bg: THEME.bg,
    fg: THEME.fg,
  },
});

// Status Bar (Bottom)
const statusBar = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  padding: { left: 1 },
  style: {
    bg: THEME.accent,
    fg: "white",
  },
});

const statusText = blessed.text({
  parent: statusBar,
  content: " Ready | Mode: Local | Press Ctrl+Q to exit",
  tags: true,
  style: {
    bg: THEME.accent,
    fg: "white",
  },
});

// --- UI Update Functions ---

function getStatusIcon(status) {
  switch (status) {
    case "running":
      return `{${THEME.success}-fg}■{/}`;
    case "starting":
      return `{${THEME.warning}-fg}▲{/}`;
    case "stopping":
      return `{${THEME.warning}-fg}▼{/}`;
    case "error":
      return `{${THEME.error}-fg}✕{/}`;
    case "stopped":
    default:
      return `{${THEME.inactive}-fg}□{/}`;
  }
}

function getStatusText(status) {
  switch (status) {
    case "running":
      return `{${THEME.success}-fg}running{/}`;
    case "starting":
      return `{${THEME.warning}-fg}starting{/}`;
    case "stopping":
      return `{${THEME.warning}-fg}stopping{/}`;
    case "error":
      return `{${THEME.error}-fg}error{/}`;
    case "stopped":
    default:
      return `{${THEME.inactive}-fg}stopped{/}`;
  }
}

function updateStatusList() {
  const items = Object.entries(workers).map(([id, worker]) => {
    const statusIcon = getStatusIcon(worker.status);
    return ` ${statusIcon} ${worker.name}`;
  });
  statusList.setItems(items);

  // Select the current worker
  const selectedIndex = Object.keys(workers).indexOf(selectedWorkerId);
  if (selectedIndex !== -1) {
    statusList.select(selectedIndex);
  }
  screen.render();
}

function updateControlBox() {
  const worker = workers[selectedWorkerId];
  if (!worker) return;

  const statusText = getStatusText(worker.status);
  const isRunning = worker.status === "running";
  const isBusy = worker.status === "starting" || worker.status === "stopping";

  let content = `{bold}${worker.name}{/}\n`;
  content += `Status: ${statusText} | Port: ${worker.port}\n`;

  // Action buttons
  content += "\n";
  content += `[s] {${isRunning || isBusy ? THEME.inactive : THEME.success}-fg}Start{/}  `;
  content += `[k] {${!isRunning || isBusy ? THEME.inactive : THEME.error}-fg}Stop{/}  `;
  content += `[r] {${!isRunning || isBusy ? THEME.inactive : THEME.warning}-fg}Restart{/}`;

  controlBox.setContent(content);
  screen.render();
}

function updateLogView() {
  const workerLogs = logs[selectedWorkerId] || ["No logs available."];

  // Clear and update logs
  logView.setContent("");
  workerLogs.forEach((line) => logView.log(line));

  // Update log box label
  logBox.setLabel(` Logs: ${workers[selectedWorkerId]?.name || "Worker"} `);

  // Scroll to bottom
  logView.setScrollPerc(100);
  screen.render();
}

function updateSystemInfo() {
  // Count workers by status
  const counts = Object.values(workers).reduce((acc, worker) => {
    acc[worker.status] = (acc[worker.status] || 0) + 1;
    return acc;
  }, {});

  let content = "{bold}System Status{/}\n\n";
  content += `Total Workers: ${Object.keys(workers).length}\n`;
  content += `Running: ${counts.running || 0}\n`;
  content += `Stopped: ${counts.stopped || 0}\n`;

  if (counts.starting) content += `Starting: ${counts.starting}\n`;
  if (counts.stopping) content += `Stopping: ${counts.stopping}\n`;
  if (counts.error) content += `Error: ${counts.error}\n`;

  systemInfo.setContent(content);
  screen.render();
}

function updateStatusBar() {
  const text = statusMessage
    ? ` ${statusMessage} | Mode: Local | Ctrl+Q to exit`
    : ` Ready | Mode: Local | Ctrl+Q to exit`;
  statusText.setContent(text);
  screen.render();
}

// --- Event Handling ---

// Quit on Ctrl-Q, q
screen.key(["C-q", "q"], () => {
  // Graceful shutdown
  setStatusMessageState("Shutting down...");
  screen.render();

  workerService
    .stopAllWorkers()
    .then(() => {
      // Add small delay to show shutdown message
      setTimeout(() => process.exit(0), 500);
    })
    .catch(() => process.exit(1));
});

// Worker navigation and selection
statusList.on("select", (_item, index) => {
  const workerId = Object.keys(workers)[index];
  selectedWorkerId = workerId;
  updateControlBox();
  updateLogView();
  screen.render();
});

// Worker control keys
screen.key("s", () => {
  if (selectedWorkerId) workerService.startWorker(selectedWorkerId);
});

screen.key("k", () => {
  if (selectedWorkerId) workerService.stopWorker(selectedWorkerId);
});

screen.key("r", () => {
  if (selectedWorkerId) workerService.restartWorker(selectedWorkerId);
});

// Global actions
screen.key(["C-s"], () => {
  console.error("Global C-s key pressed");
  workerService.startAllWorkers();
});
screen.key(["C-k"], () => {
  console.error("Global C-k key pressed");
  workerService.stopAllWorkers();
});
screen.key(["C-r"], () => {
  console.error("Global C-r key pressed");
  workerService.restartAllWorkers();
});

// Focus management (cycle through panels)
screen.key("tab", () => {
  if (screen.focused === statusList) {
    logView.focus();
  } else if (screen.focused === logView) {
    statusList.focus();
  } else {
    statusList.focus();
  }
});

// --- Initialize UI ---

function initializeUI() {
  updateStatusList();
  updateControlBox();
  updateLogView();
  updateSystemInfo();
  updateStatusBar();

  // Set initial focus
  statusList.focus();

  // Render
  screen.render();

  // Initial status check
  setStatusMessageState("Checking local worker status...");
  workerService.checkAllStatus();

  // Periodic status checks
  setInterval(() => {
    workerService.checkAllStatus();
    updateSystemInfo();
  }, 5000);
}

// Start the UI
initializeUI();
