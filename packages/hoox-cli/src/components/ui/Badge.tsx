import React from "react";
import { theme } from "../theme.js";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "destructive" | "warning" | "secondary";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  let bg = theme.colors.primary;
  let fg = theme.colors.primaryForeground;

  if (variant === "success") {
    bg = theme.colors.success;
    fg = theme.colors.foreground;
  } else if (variant === "destructive") {
    bg = theme.colors.destructive;
    fg = theme.colors.destructiveForeground;
  } else if (variant === "warning") {
    bg = theme.colors.warning;
    fg = theme.colors.foreground;
  } else if (variant === "secondary") {
    bg = theme.colors.secondary;
    fg = theme.colors.secondaryForeground;
  }

  return <text style={{ bg, fg }}> {children} </text>;
}
