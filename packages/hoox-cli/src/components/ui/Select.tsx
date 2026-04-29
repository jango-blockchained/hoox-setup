import React from 'react';
import { theme } from '../theme.js';

interface Item {
  label: string;
  value: string;
}

interface SelectProps {
  items: Item[];
  onSelect: (item: Item) => void;
  label?: string;
}

export function Select({ items, onSelect, label }: SelectProps) {
  return (
    <box style={{ flexDirection: 'column' }}>
      {label && (
        <box style={{ marginBottom: 1 }}>
          <text style={{ bold: true, fg: theme.colors.foreground }}>{label}</text>
        </box>
      )}
      <box style={{ borderStyle: 'rounded', borderColor: theme.colors.border, paddingLeft: 1, paddingRight: 1 }}>
        <select
          items={items.map(item => ({ label: item.label, value: item.value }))}
          onChange={(selectedValue: string) => {
            const item = items.find(i => i.value === selectedValue);
            if (item) onSelect(item);
          }}
        />
      </box>
    </box>
  );
}
