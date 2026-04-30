import React, { useState, useEffect, useMemo } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { WorkerService, WorkerConfig } from '../lib/workers.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Alert } from '../components/ui/Alert.js';
import { Spinner } from '../components/ui/Spinner.js';
import { theme } from '../components/theme.js';

interface TuiViewProps {
  initialWorkers: Record<string, any>;
}

/**
 * Colorize a log line based on its level.
 */
function getLogColor(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes("[error]") || lower.includes("error:") || lower.includes("err ")) return theme.colors.destructive;
  if (lower.includes("[warn]") || lower.includes("warning:") || lower.includes("warn ")) return theme.colors.warning;
  if (lower.includes("[info]") || lower.includes("info:")) return theme.colors.info;
  if (lower.includes("[debug]") || lower.includes("debug:")) return theme.colors.mutedForeground;
  return theme.colors.foreground;
}

export const TuiView: React.FC<TuiViewProps> = ({ initialWorkers }) => {
  const [workers, setWorkers] = useState<Record<string, WorkerConfig>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [statusMessage, setStatusMessage] = useState<string>("TUI initialized. Press '?' for help.");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Responsive dimensions
  const { width: termWidth, height: termHeight } = useTerminalDimensions();

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
    workerService.checkAllStatus();

    const interval = setInterval(() => {
      workerService.checkAllStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [workerService]);

  const workerIds = Object.keys(workers);
  const selectedIndex = selectedWorkerId ? workerIds.indexOf(selectedWorkerId) : -1;

  useKeyboard((key) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      process.exit(0);
    }

    // Toggle help overlay
    if (key.name === '?') {
      setShowHelp((prev) => !prev);
      return;
    }

    if (key.name === 'up' || key.name === 'k') {
      if (workerIds.length > 0) {
        const nextIdx = selectedIndex > 0 ? selectedIndex - 1 : workerIds.length - 1;
        setSelectedWorkerId(workerIds[nextIdx]);
      }
    }

    if (key.name === 'down' || key.name === 'j') {
      if (workerIds.length > 0) {
        const nextIdx = selectedIndex < workerIds.length - 1 ? selectedIndex + 1 : 0;
        setSelectedWorkerId(workerIds[nextIdx]);
      }
    }

    if (key.name === 's' && selectedWorkerId) {
      workerService.startWorker(selectedWorkerId);
    }
    if (key.name === 'x' && selectedWorkerId) {
      workerService.stopWorker(selectedWorkerId);
    }
    if (key.name === 'r' && selectedWorkerId) {
      workerService.restartWorker(selectedWorkerId);
    }
    if (key.ctrl && key.name === 'a') {
      workerService.startAllWorkers();
    }
    if (key.ctrl && key.name === 'x') {
      workerService.stopAllWorkers();
    }
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running': return 'success' as const;
      case 'error': return 'destructive' as const;
      case 'starting':
      case 'stopping': return 'warning' as const;
      default: return 'secondary' as const;
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'running': return '●';
      case 'error': return '✖';
      case 'starting':
      case 'stopping': return '◐';
      default: return '○';
    }
  };

  const selectedWorkerConfig = selectedWorkerId ? workers[selectedWorkerId] : null;
  const currentLogs = selectedWorkerId ? (logs[selectedWorkerId] || []) : [];

  // Responsive sizing
  const leftPaneWidth = Math.max(24, Math.floor(termWidth * 0.22));
  const rightPaneWidth = Math.max(22, Math.floor(termWidth * 0.22));
  const middlePaneWidth = termWidth - leftPaneWidth - rightPaneWidth - 6;
  const logHeight = Math.max(6, termHeight - 8);

  // Help overlay
  if (showHelp) {
    return (
      <box style={{ flexDirection: 'column', padding: 1, width: termWidth, height: termHeight }}>
        <Card title="⌨  Keyboard Shortcuts" padding={2}>
          <box style={{ flexDirection: 'column', gap: 1 }}>
            <text style={{ fg: theme.colors.foreground }}>  ↑/k  ↓/j    Navigate workers</text>
            <text style={{ fg: theme.colors.foreground }}>  s           Start selected worker</text>
            <text style={{ fg: theme.colors.foreground }}>  x           Stop selected worker</text>
            <text style={{ fg: theme.colors.foreground }}>  r           Restart selected worker</text>
            <text style={{ fg: theme.colors.foreground }}>  Ctrl+A      Start all workers</text>
            <text style={{ fg: theme.colors.foreground }}>  Ctrl+X      Stop all workers</text>
            <text style={{ fg: theme.colors.foreground }}>  ?           Toggle this help</text>
            <text style={{ fg: theme.colors.foreground }}>  q           Quit TUI</text>
          </box>
        </Card>
        <box style={{ marginTop: 1 }}>
          <text style={{ fg: theme.colors.mutedForeground }}>Press '?' to return to the dashboard.</text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: 'column', width: termWidth, height: termHeight }}>
      {/* Header */}
      <box style={{ paddingLeft: 1, paddingRight: 1, marginBottom: 1 }}>
        <text style={{ bold: true, fg: theme.colors.warning } as any}>⚡ HOOX</text>
        <text style={{ fg: theme.colors.mutedForeground }}>  │  </text>
        <text style={{ fg: theme.colors.mutedForeground }}>{workerIds.length} workers</text>
        <text style={{ fg: theme.colors.mutedForeground }}>  │  </text>
        <text style={{ fg: theme.colors.success }}>{Object.values(workers).filter(w => w.status === 'running').length} running</text>
      </box>

      {/* Main Content */}
      <box style={{ flexGrow: 1, flexDirection: 'row', gap: 1 }}>
        {/* Left Pane: Workers */}
        <box style={{ width: leftPaneWidth }}>
          <Card title="Workers" flexDirection="column" padding={1}>
            {workerIds.map((id) => {
              const isSelected = id === selectedWorkerId;
              const status = workers[id]?.status || 'stopped';
              const port = workers[id]?.port;
              return (
                <box key={id} style={{ flexDirection: 'column', marginBottom: 1 }}>
                  <box style={{ flexDirection: 'row' }}>
                    <text style={{ fg: isSelected ? theme.colors.primary : theme.colors.mutedForeground }}>
                      {isSelected ? '❯ ' : '  '}
                    </text>
                    <text style={{ fg: getStatusVariant(status) === 'success' ? theme.colors.success : getStatusVariant(status) === 'destructive' ? theme.colors.destructive : getStatusVariant(status) === 'warning' ? theme.colors.warning : theme.colors.mutedForeground }}>
                      {getStatusDot(status)}
                    </text>
                    <text style={{ fg: isSelected ? theme.colors.foreground : theme.colors.mutedForeground }}>
                      {' '}{id}
                    </text>
                  </box>
                  {isSelected && port && (
                    <text style={{ fg: theme.colors.mutedForeground }}>    :{port}</text>
                  )}
                </box>
              );
            })}
          </Card>
        </box>

        {/* Middle Pane: Logs */}
        <box style={{ flexGrow: 1 }}>
          <Card title={selectedWorkerId ? `Logs: ${selectedWorkerId}` : 'Logs'} flexDirection="column" padding={1}>
            <box style={{ flexDirection: 'column', height: logHeight }}>
              {currentLogs.length === 0 ? (
                <text style={{ fg: theme.colors.mutedForeground }}>
                  {selectedWorkerId ? 'No logs yet. Start the worker to see output.' : 'Select a worker to view logs.'}
                </text>
              ) : (
                currentLogs.slice(-logHeight).map((logLine, i) => (
                  <text key={i} style={{ fg: getLogColor(logLine) }}>{logLine}</text>
                ))
              )}
            </box>
          </Card>
        </box>

        {/* Right Pane: Info */}
        <box style={{ width: rightPaneWidth }}>
          <Card title="Info" flexDirection="column" padding={1}>
            {selectedWorkerConfig ? (
              <box style={{ flexDirection: 'column', gap: 1 }}>
                <box style={{ flexDirection: 'column' }}>
                  <text style={{ fg: theme.colors.mutedForeground }}>Status</text>
                  <Badge variant={getStatusVariant(selectedWorkerConfig.status || 'stopped')}>
                    {(selectedWorkerConfig.status || 'stopped').toUpperCase()}
                  </Badge>
                </box>
                <box style={{ flexDirection: 'column' }}>
                  <text style={{ fg: theme.colors.mutedForeground }}>Port</text>
                  <text style={{ fg: theme.colors.foreground }}>{selectedWorkerConfig.port || '—'}</text>
                </box>
                <box style={{ flexDirection: 'column' }}>
                  <text style={{ fg: theme.colors.mutedForeground }}>Args</text>
                  <text style={{ fg: theme.colors.foreground }}>{selectedWorkerConfig.extraArgs || 'None'}</text>
                </box>
              </box>
            ) : (
              <text style={{ fg: theme.colors.mutedForeground }}>No worker selected.</text>
            )}

            <box style={{ marginTop: 2, flexDirection: 'column' }}>
              <text style={{ bold: true, fg: theme.colors.foreground } as any}>Shortcuts</text>
              <text style={{ fg: theme.colors.mutedForeground }}>s  Start</text>
              <text style={{ fg: theme.colors.mutedForeground }}>x  Stop</text>
              <text style={{ fg: theme.colors.mutedForeground }}>r  Restart</text>
              <text style={{ fg: theme.colors.mutedForeground }}>?  Help</text>
              <text style={{ fg: theme.colors.mutedForeground }}>q  Quit</text>
            </box>
          </Card>
        </box>
      </box>

      {/* Footer */}
      <box style={{ paddingLeft: 1, paddingRight: 1, borderStyle: 'rounded', borderColor: theme.colors.border }}>
        <text style={{ fg: theme.colors.info }}>⚡ </text>
        <text style={{ fg: theme.colors.foreground }}>{statusMessage}</text>
      </box>
    </box>
  );
};
