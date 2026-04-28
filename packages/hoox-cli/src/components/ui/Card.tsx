import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  width?: string | number;
  flexDirection?: 'row' | 'column';
  padding?: number;
}

export function Card({ title, description, children, width, flexDirection = 'column', padding = 1 }: CardProps) {
  return (
    <Box 
      borderStyle="round" 
      borderColor={theme.colors.border} 
      padding={padding} 
      flexDirection="column"
      width={width}
    >
      {(title || description) && (
        <Box flexDirection="column" marginBottom={1}>
          {title && <Text bold color={theme.colors.foreground}>{title}</Text>}
          {description && <Text color={theme.colors.mutedForeground}>{description}</Text>}
        </Box>
      )}
      <Box flexDirection={flexDirection}>
        {children}
      </Box>
    </Box>
  );
}
