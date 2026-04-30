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
          <text style={{ bold: true, fg: theme.colors.foreground } as any}>{label}</text>
        </box>
      )}
      <box style={{ borderStyle: 'rounded', borderColor: theme.colors.border, paddingLeft: 1, paddingRight: 1 }}>
        <select
          options={items.map(item => ({ name: item.label, value: item.value, description: '' }))}
          onChange={(index: number, option: any) => {
            if (option) {
              const item = items.find(i => i.value === option.value);
              if (item) onSelect(item);
            }
          }}
        />
      </box>
    </box>
  );
}
