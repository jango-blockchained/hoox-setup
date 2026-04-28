import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
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
    <Box flexDirection="column">
      {label && <Box marginBottom={1}><Text bold color={theme.colors.foreground}>{label}</Text></Box>}
      <Box borderStyle="round" borderColor={theme.colors.border} paddingX={1} paddingY={0}>
        <SelectInput 
          items={items} 
          onSelect={onSelect}
          indicatorComponent={({ isSelected }) => (
            <Text color={isSelected ? theme.colors.primary : theme.colors.foreground}>
              {isSelected ? '❯ ' : '  '}
            </Text>
          )}
          itemComponent={({ isSelected, label }) => (
            <Text color={isSelected ? theme.colors.primary : theme.colors.foreground}>
              {label}
            </Text>
          )}
        />
      </Box>
    </Box>
  );
}
