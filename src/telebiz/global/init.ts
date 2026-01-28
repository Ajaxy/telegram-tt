import './intervals';

import { addActionHandler, getActions, getGlobal } from '../../global';

import { logDebugMessage } from '../../util/debugConsole';
import { onConnectionChange, startMcpBridge, stopMcpBridge } from '../agent/mcp/bridge';
import { cancelTokenRefresh } from './actions/auth';
import { selectIsMcpEnabled } from './selectors';

let isInitialized = false;
let mcpConnectionCleanup: (() => void) | undefined;

addActionHandler('telebizInit', (): void => {
  if (isInitialized) {
    logDebugMessage('log', 'TELEBIZ_INIT: Already initialized, skipping');
    return;
  }

  logDebugMessage('log', 'TELEBIZ_INIT: Initializing telebiz');
  isInitialized = true;

  const {
    telebizInitAuth,
    telebizInitAgent,
    updateMcpConnectionStatus,
  } = getActions();

  telebizInitAuth();
  telebizInitAgent();

  // Wire up MCP connection listener
  mcpConnectionCleanup = onConnectionChange((connected) => {
    updateMcpConnectionStatus({ isConnected: connected });
  });

  // Start MCP bridge if it was previously enabled
  const global = getGlobal();
  const isMcpEnabled = selectIsMcpEnabled(global);
  if (isMcpEnabled) {
    startMcpBridge();
  }
});

addActionHandler('telebizCleanup', (): void => {
  logDebugMessage('log', 'TELEBIZ_INIT: Cleaning up telebiz');
  cancelTokenRefresh();
  mcpConnectionCleanup?.();
  mcpConnectionCleanup = undefined;
  stopMcpBridge();
  isInitialized = false;
});
