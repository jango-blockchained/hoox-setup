import React, { useEffect, useMemo, useState } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { WorkerService, WorkerConfig } from '../lib/workers.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { theme } from '../components/theme.js';

interface TuiViewProps {
  initialWorkers: Record<string, any>;
  initialTab?: string;
  autoStartAll?: boolean;
}

type TabKey = 'overview' | 'logs' | 'positions' | 'metrics' | 'ai';

const tabs: TabKey[] = ['overview', 'logs', 'positions', 'metrics', 'ai'];

const placeholder = 'placeholder';

function getLogColor(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('error')) return theme.colors.destructive;
  if (lower.includes('warn')) return theme.colors.warning;
  if (lower.includes('info')) return theme.colors.info;
  return theme.colors.foreground;
}

export const TuiView: React.FC<TuiViewProps> = ({ initialWorkers, initialTab = 'overview', autoStartAll = false }) => {
  const [workers, setWorkers] = useState<Record<string, WorkerConfig>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [statusMessage, setStatusMessage] = useState('TUI initialized. 1-5 switch tabs.');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(tabs.includes(initialTab as TabKey) ? (initialTab as TabKey) : 'overview');

  const { width: termWidth, height: termHeight } = useTerminalDimensions();

  const workerService = useMemo(() => new WorkerService(initialWorkers, setWorkers, setLogs, setStatusMessage), []);

  useEffect(() => {
    const ids = Object.keys(initialWorkers);
    if (ids.length > 0) setSelectedWorkerId(ids[0]);
    workerService.checkAllStatus();
    if (autoStartAll) workerService.startAllWorkers();
    const interval = setInterval(() => workerService.checkAllStatus(), 5000);
    return () => clearInterval(interval);
  }, [workerService, autoStartAll, initialWorkers]);

  const workerIds = Object.keys(workers);
  const selectedIndex = selectedWorkerId ? workerIds.indexOf(selectedWorkerId) : -1;
  const selectedWorkerConfig = selectedWorkerId ? workers[selectedWorkerId] : null;
  const currentLogs = selectedWorkerId ? (logs[selectedWorkerId] || []) : [];

  useKeyboard((key) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) process.exit(0);
    if (key.name === 'up' || key.name === 'k') {
      if (workerIds.length > 0) setSelectedWorkerId(workerIds[selectedIndex > 0 ? selectedIndex - 1 : workerIds.length - 1]);
    }
    if (key.name === 'down' || key.name === 'j') {
      if (workerIds.length > 0) setSelectedWorkerId(workerIds[selectedIndex < workerIds.length - 1 ? selectedIndex + 1 : 0]);
    }
    if (key.name === 's' && selectedWorkerId) workerService.startWorker(selectedWorkerId);
    if (key.name === 'x' && selectedWorkerId) workerService.stopWorker(selectedWorkerId);
    if (key.name === 'r' && selectedWorkerId) workerService.restartWorker(selectedWorkerId);
    if (key.ctrl && key.name === 'a') workerService.startAllWorkers();
    if (key.ctrl && key.name === 'x') workerService.stopAllWorkers();
    if (key.name === '1') setActiveTab('overview');
    if (key.name === '2') setActiveTab('logs');
    if (key.name === '3') setActiveTab('positions');
    if (key.name === '4') setActiveTab('metrics');
    if (key.name === '5') setActiveTab('ai');
  });

  const runningCount = Object.values(workers).filter((w) => w.status === 'running').length;
  const total = Math.max(1, workerIds.length);
  const logHeight = Math.max(8, termHeight - 11);

  const renderMain = () => {
    if (activeTab === 'logs') {
      return <Card title={`Live Logs ${selectedWorkerId ? `· ${selectedWorkerId}` : ''}`} padding={1}>
        <box style={{ flexDirection: 'column', height: logHeight }}>
          {currentLogs.length === 0 ? <text style={{ fg: theme.colors.mutedForeground }}>No live logs yet ({placeholder}).</text> : currentLogs.slice(-logHeight).map((line, i) => <text key={i} style={{ fg: getLogColor(line) }}>{line}</text>)}
        </box>
      </Card>;
    }

    if (activeTab === 'positions') {
      return <Card title="Positions & Trade Metrics" padding={1}>
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: theme.colors.foreground }}>Open positions: 3 ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Gross exposure: $42,500 ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Unrealized PnL: +$1,240 ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Win rate (24h): 61% ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Avg slippage: 0.18% ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Last execution latency: 112ms ({placeholder})</text>
        </box>
      </Card>;
    }

    if (activeTab === 'metrics') {
      return <Card title="System Metrics" padding={1}>
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: theme.colors.foreground }}>CPU: 34% ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Memory: 1.7GB / 8GB ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Queue depth: 12 ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Error rate (5m): 0.7% ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>P95 webhook latency: 244ms ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Cloudflare incidents: none ({placeholder})</text>
        </box>
      </Card>;
    }

    if (activeTab === 'ai') {
      return <Card title="AI Risk Manager" padding={1}>
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text style={{ fg: theme.colors.info }}>Market regime: Risk-On ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Confidence: 0.78 ({placeholder})</text>
          <text style={{ fg: theme.colors.warning }}>Guardrail: max leverage 2.5x ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Suggested action: tighten stops ({placeholder})</text>
          <text style={{ fg: theme.colors.foreground }}>Recent rationale: volatility compression detected ({placeholder})</text>
        </box>
      </Card>;
    }

    return <Card title="Overview" padding={1}>
      <box style={{ flexDirection: 'column', gap: 1 }}>
        <text style={{ fg: theme.colors.foreground }}>Workers running: {runningCount}/{total}</text>
        <text style={{ fg: theme.colors.foreground }}>Portfolio snapshot: healthy ({placeholder})</text>
        <text style={{ fg: theme.colors.foreground }}>AI risk state: nominal ({placeholder})</text>
        <text style={{ fg: theme.colors.foreground }}>Latest trade: BTC/USDT long +0.4% ({placeholder})</text>
        <text style={{ fg: theme.colors.foreground }}>Use 1-5 to switch sections.</text>
      </box>
    </Card>;
  };

  return <box style={{ flexDirection: 'column', width: termWidth, height: termHeight }}>
    <box style={{ paddingLeft: 1, paddingRight: 1, marginBottom: 1 }}>
      <text style={{ bold: true, fg: theme.colors.warning } as any}>⚡ HOOX CONTROL CENTER</text>
      <text style={{ fg: theme.colors.mutedForeground }}>  {runningCount}/{total} running</text>
    </box>

    <box style={{ paddingLeft: 1, marginBottom: 1 }}>
      {tabs.map((t, i) => <text key={t} style={{ fg: activeTab === t ? theme.colors.primary : theme.colors.mutedForeground }}>{`${i + 1}.${t.toUpperCase()}  `}</text>)}
    </box>

    <box style={{ flexGrow: 1, flexDirection: 'row', gap: 1 }}>
      <box style={{ width: Math.max(24, Math.floor(termWidth * 0.24)) }}>
        <Card title="Workers" padding={1}>
          <box style={{ flexDirection: 'column' }}>
            {workerIds.map((id) => <text key={id} style={{ fg: selectedWorkerId === id ? theme.colors.primary : theme.colors.foreground }}>{selectedWorkerId === id ? '❯ ' : '  '}{id} · {workers[id]?.status || 'stopped'}</text>)}
          </box>
        </Card>
      </box>
      <box style={{ flexGrow: 1 }}>{renderMain()}</box>
      <box style={{ width: Math.max(24, Math.floor(termWidth * 0.24)) }}>
        <Card title="Worker Detail" padding={1}>
          <box style={{ flexDirection: 'column', gap: 1 }}>
            <text style={{ fg: theme.colors.mutedForeground }}>Selected</text>
            <text style={{ fg: theme.colors.foreground }}>{selectedWorkerId || 'none'}</text>
            <text style={{ fg: theme.colors.mutedForeground }}>Status</text>
            <Badge variant={selectedWorkerConfig?.status === 'running' ? 'success' : 'secondary'}>{(selectedWorkerConfig?.status || 'stopped').toUpperCase()}</Badge>
            <text style={{ fg: theme.colors.mutedForeground }}>Port</text>
            <text style={{ fg: theme.colors.foreground }}>{selectedWorkerConfig?.port || '—'}</text>
          </box>
        </Card>
      </box>
    </box>

    <box style={{ paddingLeft: 1, paddingRight: 1, borderStyle: 'rounded', borderColor: theme.colors.border }}>
      <text style={{ fg: theme.colors.info }}>⚡ </text>
      <text style={{ fg: theme.colors.foreground }}>{statusMessage}</text>
      <text style={{ fg: theme.colors.mutedForeground }}>  | s start · x stop · r restart · q quit</text>
    </box>
  </box>;
};
