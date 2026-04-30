import React, { useState, useEffect } from 'react';
import { theme } from '../theme.js';

interface SpinnerProps {
  label?: string;
}

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ label }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <box style={{ flexDirection: 'row', gap: 1 }}>
      <text style={{ fg: theme.colors.info }}>{FRAMES[frame]}</text>
      {label && <text style={{ fg: theme.colors.mutedForeground }}>{label}</text>}
    </box>
  );
}
