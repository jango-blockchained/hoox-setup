import React from 'react';
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { TuiView } from '../views/TuiView.js';
import { loadConfig } from '../configUtils.js';

export async function runTui() {
  const config = await loadConfig();
  const initialWorkers = config.workers || {};

  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  createRoot(renderer).render(React.createElement(TuiView, { initialWorkers }));
}
