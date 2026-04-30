import React, { useEffect, useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { loadConfig } from '../configUtils.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Spinner } from '../components/ui/Spinner.js';
import { theme } from '../components/theme.js';

interface WorkerInfo {
  name: string;
  enabled: boolean;
  path: string;
  deployed_url?: string;
}

export function StatusView() {
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);

  useKeyboard((key) => {
    if (key.name === 'q' || key.name === 'escape') {
      process.exit(0);
    }
  });

  useEffect(() => {
    loadConfig().then(config => {
      const workerList = Object.entries(config.workers || {}).map(([name, wc]: [string, any]) => ({
        name,
        enabled: wc.enabled ?? false,
        path: wc.path ?? `workers/${name}`,
        deployed_url: wc.deployed_url,
      }));
      setWorkers(workerList);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <box style={{ padding: 1 }}>
        <Spinner label="Loading worker configuration..." />
      </box>
    );
  }

  const enabledCount = workers.filter(w => w.enabled).length;

  return (
    <box style={{ flexDirection: 'column', padding: 1 }}>
      <Card title={`Hoox Worker Status (${enabledCount}/${workers.length} enabled)`}>
        <box style={{ flexDirection: 'column', marginTop: 1, gap: 1 }}>
          {workers.map(w => (
            <box key={w.name} style={{ flexDirection: 'row', gap: 1 }}>
              <box style={{ width: 24 }}>
                <text style={{ fg: w.enabled ? theme.colors.foreground : theme.colors.mutedForeground }}>
                  {w.enabled ? theme.icons.bullet : theme.icons.hollowBullet} {w.name}
                </text>
              </box>
              <box style={{ width: 12 }}>
                <Badge variant={w.enabled ? 'success' : 'secondary'}>
                  {w.enabled ? 'ENABLED' : 'DISABLED'}
                </Badge>
              </box>
              {w.deployed_url && (
                <text style={{ fg: theme.colors.mutedForeground }}>{w.deployed_url}</text>
              )}
            </box>
          ))}
        </box>
      </Card>
      <box style={{ marginTop: 1 }}>
        <text style={{ fg: theme.colors.mutedForeground }}>Press 'q' or 'ESC' to exit.</text>
      </box>
    </box>
  );
}