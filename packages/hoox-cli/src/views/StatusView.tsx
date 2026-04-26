import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Spinner } from '../components/ui/Spinner.js';
import { Badge } from '../components/ui/Badge.js';
import { loadConfig } from '../configUtils.js';

export function StatusView() {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<string[]>([]);

  useEffect(() => {
    loadConfig().then(config => {
      setWorkers(Object.keys(config.workers));
      setLoading(false);
      // Give it a moment to render the final frame, then exit
      setTimeout(() => exit(), 50);
    });
  }, [exit]);

  if (loading) return <Spinner label="Loading worker configuration..." />;

  return (
    <Box flexDirection="column" gap={1} padding={1}>
      <Text bold>Hoox Worker Status</Text>
      <Box flexDirection="column">
        {workers.map(w => (
          <Box key={w} gap={2}>
            <Box width={20}><Text>{w}</Text></Box>
            <Badge variant="success">ONLINE</Badge>
          </Box>
        ))}
      </Box>
    </Box>
  );
}