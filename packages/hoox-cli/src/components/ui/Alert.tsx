import React from "react";
import { theme } from "../theme.js";

interface AlertProps {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "destructive" | "success" | "warning";
}

export function Alert({ title, children, variant = "default" }: AlertProps) {
  let borderColor = theme.colors.border;
  let titleColor = theme.colors.foreground;

  if (variant === "destructive") {
    borderColor = theme.colors.destructive;
    titleColor = theme.colors.destructive;
  } else if (variant === "success") {
    borderColor = theme.colors.success;
    titleColor = theme.colors.success;
  } else if (variant === "warning") {
    borderColor = theme.colors.warning;
    titleColor = theme.colors.warning;
  }

  return (
    <box
      style={{
        borderStyle: "rounded",
        borderColor,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: "column",
      }}
    >
      <text style={{ bold: true, fg: titleColor } as any}>{title}</text>
      <box style={{ marginTop: 1, flexDirection: "column" }}>{children}</box>
    </box>
  );
}
