import React from 'react';
import { Text } from 'ink';
import { theme } from '../theme.js';

export function Badge({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'error' }) {
  let bg = theme.colors.cardBorder;
  if (variant === 'success') bg = theme.colors.success;
  if (variant === 'error') bg = theme.colors.error;
  
  return <Text backgroundColor={bg} color="#000"> {children} </Text>;
}
