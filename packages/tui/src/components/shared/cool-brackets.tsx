/** @jsxImportSource @opentui/react */
/**
 * CoolBrackets — animated cyan→indigo→violet corner/pair brackets
 * inspired by Grok Build TUI accent motion.
 *
 * In test / React act environments the palette freezes on the first cool
 * frame so snapshots stay stable.
 */
import { useState, useEffect, type ReactNode } from "react";
import { Colors, CoolBracketPalette } from "@jango-blockchained/hoox-shared";

/** True when running under OpenTUI/React test act environment. */
function isTestEnv(): boolean {
  return (
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT === true || process.env.NODE_ENV === "test"
  );
}

/**
 * Cycle cool palette index. Shared by brackets and optional accent borders.
 * Returns static 0 under tests.
 */
export function useCoolHue(
  intervalMs = 120,
  enabled = true
): { color: string; index: number } {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || isTestEnv()) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % CoolBracketPalette.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);

  return {
    index,
    color: CoolBracketPalette[index] ?? Colors.accent,
  };
}

export interface CoolBracketsProps {
  /** Content between the brackets */
  children?: ReactNode;
  /** Left glyph (default ┌) */
  open?: string;
  /** Right glyph (default ┐) */
  close?: string;
  /** Animation step interval ms */
  intervalMs?: number;
  /** Freeze animation */
  static?: boolean;
  /** Phase offset so paired brackets can be offset from each other */
  phase?: number;
  /** Gap between open, children, close */
  gap?: number;
}

/**
 * Renders open + optional children + close with cycling cool colors.
 * Open and close use adjacent palette steps for a traveling-light feel.
 */
export function CoolBrackets({
  children,
  open = "┌",
  close = "┐",
  intervalMs = 110,
  static: forceStatic = false,
  phase = 0,
  gap = 1,
}: CoolBracketsProps) {
  const { index } = useCoolHue(intervalMs, !forceStatic);
  const openColor =
    CoolBracketPalette[(index + phase) % CoolBracketPalette.length] ??
    Colors.accent;
  const closeColor =
    CoolBracketPalette[(index + phase + 3) % CoolBracketPalette.length] ??
    Colors.highlight;

  return (
    <box flexDirection="row" gap={gap} alignItems="center">
      <text fg={openColor}>{open}</text>
      {children ?? null}
      <text fg={closeColor}>{close}</text>
    </box>
  );
}

/**
 * Inline single glyph with cool hue (for ▸ markers, pipes, etc.).
 */
export function CoolGlyph({
  char,
  intervalMs = 140,
  phase = 0,
}: {
  char: string;
  intervalMs?: number;
  phase?: number;
}) {
  const { index } = useCoolHue(intervalMs, true);
  const color =
    CoolBracketPalette[(index + phase) % CoolBracketPalette.length] ??
    Colors.accent;
  return <text fg={color}>{char}</text>;
}
