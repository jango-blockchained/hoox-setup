import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

interface AlertProps {
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}

export function Alert({ title, children, variant = 'default' }: AlertProps) {
  let borderColor = theme.colors.border;
  let titleColor = theme.colors.foreground;

  if (variant === 'destructive') {
    borderColor = theme.colors.destructive;
    titleColor = theme.colors.destructive;
  } else if (variant === 'success') {
    borderColor = theme.colors.success;
    titleColor = theme.colors.success;
  } else if (variant === 'warning') {
    borderColor = theme.colors.warning;
    titleColor = theme.colors.warning;
  }

  return (
    <Box borderStyle="round" borderColor={borderColor} paddingX={1} flexDirection="column">
      <Text color={titleColor} bold>{title}</Text>
<Box marginTop={1} flexDirection="column">
  {children}
</Box>
    </Box>
  );
}
