import React from 'react';
import { Text } from 'ink';
import { theme } from '../theme.js';

export function Spinner({ label }: { label: string }) {
  // Simple placeholder until we dlx shadcn add @termcn/spinner
  return <Text color={theme.colors.primary}>⠋ {label}</Text>;
}
