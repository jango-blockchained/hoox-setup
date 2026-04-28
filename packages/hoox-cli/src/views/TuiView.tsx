import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { WorkerService, WorkerConfig } from '../lib/workers.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Alert } from '../components/ui/Alert.js';
import { theme } from '../components/theme.js';

interface TuiViewProps {
  initialWorkers: Record<string, any>;
}

export const TuiView: React.FC<TuiViewProps> = ({ initialWorkers }) => {
  const { exit } = useApp();
  const [workers, setWorkers] = useState<Record<string, WorkerConfig>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [statusMessage, setStatusMessage] = useState<string>("TUI initialized");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  const workerService = useMemo(() => {
    return new WorkerService(
      initialWorkers,
      setWorkers,
      setLogs,
      setStatusMessage
    );
  }, []);

  useEffect(() => {
    const ids = Object.keys(initialWorkers);
    if (ids.length > 0) setSelectedWorkerId(ids[0]);
    
    // Initial status check
    workerService.checkAllStatus();
    
    const interval = setInterval(() => {
      workerService.checkAllStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [workerService]);

  const workerIds = Object.keys(workers);
  const selectedIndex = selectedWorkerId ? workerIds.indexOf(selectedWorkerId) : -1;

  useInput((input, key) => {
    if (key.return) return;

    if (input === 'q' || input === 'Q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }

    if (key.upArrow) {
      if (workerIds.length > 0) {
        const nextIdx = selectedIndex > 0 ? selectedIndex - 1 : workerIds.length - 1;
        setSelectedWorkerId(workerIds[nextIdx]);
      }
    }

    if (key.downArrow) {
      if (workerIds.length > 0) {
        const nextIdx = selectedIndex < workerIds.length - 1 ? selectedIndex + 1 : 0;
        setSelectedWorkerId(workerIds[nextIdx]);
      }
    }

    // Global hotkeys
    if (key.ctrl && input === 's' && selectedWorkerId) {
      workerService.startWorker(selectedWorkerId);
    }
    if (key.ctrl && input === 'k' && selectedWorkerId) {
      workerService.stopWorker(selectedWorkerId);
    }
    if (key.ctrl && input === 'r' && selectedWorkerId) {
      workerService.restartWorker(selectedWorkerId);
    }
    if (key.ctrl && input === 'a') {
      workerService.startAllWorkers();
    }
    if (key.ctrl && input === 'x') {
      workerService.stopAllWorkers();
    }
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'error': return 'destructive';
      case 'starting':
      case 'stopping': return 'warning';
      default: return 'secondary';
    }
  };

  const selectedWorkerConfig = selectedWorkerId ? workers[selectedWorkerId] : null;
  const currentLogs = selectedWorkerId ? (logs[selectedWorkerId] || []) : [];

  return (
    <Box flexDirection="column" height={24} width={120}>
      <Box flexGrow={1} flexDirection="row" gap={1}>
        {/* Left Pane: Workers */}
        <Box width="25%">
          <Card title="Workers" flexDirection="column" padding={1}>
            {workerIds.map((id) => {
              const isSelected = id === selectedWorkerId;
              const status = workers[id]?.status || 'stopped';
              return (
                <Box key={id} flexDirection="row" marginBottom={1}>
                  <Text color={isSelected ? theme.colors.primary : theme.colors.foreground}>
                    {isSelected ? '❯ ' : '  '}
                    {id}
                  </Text>
                  <Box marginLeft={1}>
                    <Badge variant={getStatusVariant(status)}>{status}</Badge>
                  </Box>
                </Box>
              );
            })}
          </Card>
        </Box>

        {/* Middle Pane: Logs / Details */}
        <Box width="50%">
          <Card title={selectedWorkerId ? `Logs: ${selectedWorkerId}` : 'Logs'} flexDirection="column" padding={1}>
            <Box flexDirection="column" flexGrow={1} height={18} overflowY="hidden">
              {currentLogs.length === 0 ? (
                <Text color={theme.colors.mutedForeground}>No logs available.</Text>
              ) : (
                currentLogs.slice(-16).map((log, i) => (
                  <Text key={i} color={theme.colors.mutedForeground}>{log}</Text>
                ))
              )}
            </Box>
          </Card>
        </Box>

        {/* Right Pane: System / Info */}
        <Box width="25%">
          <Card title="Controls & Info" flexDirection="column" padding={1}>
            {selectedWorkerConfig && (
              <Box flexDirection="column" marginBottom={1}>
                <Text color={theme.colors.mutedForeground}>Port: <Text color={theme.colors.foreground}>{selectedWorkerConfig.port}</Text></Text>
                <Text color={theme.colors.mutedForeground}>Args: <Text color={theme.colors.foreground}>{selectedWorkerConfig.extraArgs || 'None'}</Text></Text>
              </Box>
            )}
            
            <Alert title="Hotkeys" variant="default">
              <Box flexDirection="column">
                <Text>↑/↓    : Select worker</Text>
                <Text>Ctrl+S : Start selected</Text>
                <Text>Ctrl+K : Stop selected</Text>
                <Text>Ctrl+R : Restart selected</Text>
                <Text>Ctrl+A : Start all</Text>
                <Text>Ctrl+X : Stop all</Text>
                <Text>q      : Quit TUI</Text>
              </Box>
            </Alert>
          </Card>
        </Box>
      </Box>

      {/* Footer / Status */}
      <Box paddingX={1} borderStyle="round" borderColor={theme.colors.border}>
        <Text color={theme.colors.info}>Status: </Text>
        <Text color={theme.colors.foreground}>{statusMessage}</Text>
      </Box>
    </Box>
  );
};
