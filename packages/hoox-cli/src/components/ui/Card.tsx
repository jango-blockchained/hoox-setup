import React from "react";
import { theme } from "../theme.js";

interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  width?: number | `${number}%` | "auto";
  flexDirection?: "row" | "column";
  padding?: number;
}

export function Card({
  title,
  description,
  children,
  width,
  flexDirection = "column",
  padding = 1,
}: CardProps) {
  return (
    <box
      style={{
        borderStyle: "rounded",
        borderColor: theme.colors.border,
        padding,
        flexDirection: "column",
        width,
      }}
    >
      {(title || description) && (
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          {title && (
            <text style={{ bold: true, fg: theme.colors.foreground } as any}>
              {title}
            </text>
          )}
          {description && (
            <text style={{ fg: theme.colors.mutedForeground }}>
              {description}
            </text>
          )}
        </box>
      )}
      <box style={{ flexDirection }}>{children}</box>
    </box>
  );
}
