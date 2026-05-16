/** @jsxImportSource @opentui/react */

import { useState } from "react";
import { Colors } from "@jango-blockchained/hoox-shared";
import { useUIStore } from "@jango-blockchained/hoox-shared/stores/ui-store";
import { VIEW_ORDER, viewIndex, type ViewId } from "../../types";

/**
 * Sidebar — 4-column navigation panel.
 *
 * Composed of:
 *   LogoMark  — 'H' in an orange-bordered box
 *   NavDots   — one clickable dot per view (10 total)
 *   ProgressBar — accent fill bar + fraction text
 *
 * Expandable on hover / Ctrl+B via UI store.
 */

// ---- LogoMark ------------------------------------------------------------------------

function LogoMark({ expanded }: { expanded: boolean }) {
  return (
    <box
      width={3}
      height={3}
      border={true}
      borderStyle="single"
      justifyContent="center"
      alignItems="center"
      padding={0}
    >
      <text fg={Colors.accent.toHex()} bold>
        {expanded ? "HOOX" : "H"}
      </text>
    </box>
  );
}

// ---- NavDots -------------------------------------------------------------------------

interface NavDotsProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
}

function NavDots({ activeView, onNavigate }: NavDotsProps) {
  return (
    <box flexDirection="column" gap={0} padding={0} justifyContent="center">
      {VIEW_ORDER.map((view) => {
        const isActive = view === activeView;
        return (
          <box
            key={view}
            width={4}
            height={1}
            justifyContent="center"
            alignItems="center"
          >
            <text
              fg={isActive ? Colors.accent.toHex() : Colors.muted.toHex()}
              bold={isActive}
              dim={!isActive}
              onMouseUp={() => onNavigate(view)}
            >
              {isActive ? "●" : "○"}
            </text>
          </box>
        );
      })}
    </box>
  );
}

// ---- ProgressBar ---------------------------------------------------------------------

interface ProgressBarProps {
  current: number; // 0-based active view index
  total: number;
}

function ProgressBar({ current, total }: ProgressBarProps) {
  const filled = Math.round(((current + 1) / total) * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  return (
    <box flexDirection="column" width={4} gap={0} padding={0}>
      <text fg={Colors.accent.toHex()}>{bar}</text>
      <text fg={Colors.muted.toHex()} dim>
        {current + 1}/{total}
      </text>
    </box>
  );
}

// ---- Sidebar (composed) --------------------------------------------------------------

export function Sidebar() {
  const [hovered, setHovered] = useState(false);

  const activeView = useUIStore((s) => s.activeView);
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const expanded = sidebarExpanded || hovered;

  function handleNavigate(view: ViewId) {
    setActiveView(view);
  }

  return (
    <box
      width={4}
      flexDirection="column"
      justifyContent="space-between"
      paddingTop={1}
      paddingBottom={1}
      gap={1}
      border={true}
      borderStyle="single"
      backgroundColor={Colors.card.toHex()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top section: Logo + Dots */}
      <box flexDirection="column" gap={1} alignItems="center">
        <LogoMark expanded={expanded} />
        <NavDots activeView={activeView} onNavigate={handleNavigate} />
      </box>

      {/* Bottom section: Progress */}
      <box flexDirection="column" alignItems="center" gap={0}>
        <ProgressBar
          current={viewIndex(activeView)}
          total={VIEW_ORDER.length}
        />
      </box>
    </box>
  );
}
