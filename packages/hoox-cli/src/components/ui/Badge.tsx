import React from 'react';
import { Text } from 'ink';
import { theme } from '../theme.js';

export function Badge({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'destructive' | 'warning' | 'secondary' }) {
  let bg = theme.colors.primary;
  let color = theme.colors.primaryForeground;
  
  if (variant === 'success') { bg = theme.colors.success; color = theme.colors.foreground; }
  else if (variant === 'destructive') { bg = theme.colors.destructive; color = theme.colors.destructiveForeground; }
  else if (variant === 'warning') { bg = theme.colors.warning; color = theme.colors.foreground; }
  else if (variant === 'secondary') { bg = theme.colors.secondary; color = theme.colors.secondaryForeground; }
  else if (variant === 'default') { bg = theme.colors.primary; color = theme.colors.primaryForeground; }
  
  return <Text backgroundColor={bg} color={color}> {children} </Text>;
}
