import React from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { intro, outro, select, isCancel, cancel, confirm, note } from "@clack/prompts";
import { TuiView } from "../views/TuiView.js";
import { loadConfig } from "../configUtils.js";

export async function runTui() {
  const config = await loadConfig();
  const initialWorkers = config.workers || {};

  intro("⚡ Hoox TUI Control Center");

  const focus = await select({
    message: "Choose your default dashboard focus",
    options: [
      { value: "overview", label: "Overview (recommended)", hint: "System, workers, AI insights" },
      { value: "logs", label: "Live logs", hint: "Start with streaming worker logs" },
      { value: "positions", label: "Positions & trades", hint: "Portfolio and execution metrics" },
    ],
  });

  if (isCancel(focus)) {
    cancel("TUI launch cancelled.");
    return;
  }

  const autostart = await confirm({
    message: "Auto-start all configured workers?",
    initialValue: false,
  });

  if (isCancel(autostart)) {
    cancel("TUI launch cancelled.");
    return;
  }

  note(
    "All sections gracefully fall back to placeholders when metrics are unavailable.",
    "Placeholder mode",
  );

  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  createRoot(renderer).render(
    React.createElement(TuiView, {
      initialWorkers,
      initialTab: String(focus),
      autoStartAll: Boolean(autostart),
    }),
  );

  outro("Hoox TUI started");
}
