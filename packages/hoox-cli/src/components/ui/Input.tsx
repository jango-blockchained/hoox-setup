import React from "react";
import { theme } from "../theme.js";

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function Input({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
}: InputProps) {
  return (
    <box style={{ flexDirection: "column" }}>
      {label && (
        <box style={{ marginBottom: 1 }}>
          <text style={{ bold: true, fg: theme.colors.foreground } as any}>
            {label}
          </text>
        </box>
      )}
      <box
        style={{
          borderStyle: "rounded",
          borderColor: theme.colors.border,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <input
          value={value}
          onChange={onChange}
          onSubmit={onSubmit as any}
          placeholder={placeholder}
        />
      </box>
    </box>
  );
}
