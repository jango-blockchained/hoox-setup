import React from 'react';
import { render } from 'ink';
import { TuiView } from '../views/TuiView.js';
import { loadConfig } from '../configUtils.js';

export async function runTui() {
  const config = await loadConfig();
  const initialWorkers = config.workers || {};
  
  const { waitUntilExit, unmount } = render(React.createElement(TuiView, { initialWorkers }));
  await waitUntilExit();
  unmount();
}
