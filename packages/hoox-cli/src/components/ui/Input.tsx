import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function Input({ value, onChange, onSubmit, placeholder, label }: InputProps) {
  return (
    <Box flexDirection="column">
      {label && <Box marginBottom={1}><Text bold color={theme.colors.foreground}>{label}</Text></Box>}
      <Box borderStyle="round" borderColor={theme.colors.border} paddingX={1}>
        <TextInput 
          value={value} 
          onChange={onChange} 
          onSubmit={onSubmit} 
          placeholder={placeholder} 
        />
      </Box>
    </Box>
  );
}
