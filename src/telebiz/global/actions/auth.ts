import { addActionHandler, getActions, getGlobal, setGlobal } from '../../../global';

import type { ActionReturnType } from '../../../global/types';

import { AUTH_BOT_USERNAME } from '../../../config';
import { selectChatByUsername, selectChatMessages } from '../../../global/selectors';
import { logDebugMessage } from '../../../util/debugConsole';
import { telebizApiClient } from '../../services';
import { updateTelebizAuth } from '../reducers';

const TOKEN_REFRESH_INTERVAL = 60000;
const TOKEN_POLL_INTERVAL = 2000; // Poll every 2 seconds
const TOKEN_POLL_MAX_ATTEMPTS = 30; // Max 30 attempts (60 seconds total)

let tokenRefreshTimeout: ReturnType<typeof setTimeout> | undefined;
let tokenPollInterval: ReturnType<typeof setInterval> | undefined;
let tokenPollAttempts = 0;
let lastProcessedToken: string | undefined; // Track last processed token to avoid duplicates

export function scheduleTokenRefresh() {
  cancelTokenRefresh();
  logDebugMessage('log', 'TELEBIZ_AUTH: Scheduling token refresh');
  tokenRefreshTimeout = setTimeout(() => {
    getActions().telebizRefreshToken();
  }, TOKEN_REFRESH_INTERVAL);
}

export function cancelTokenRefresh() {
  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
    tokenRefreshTimeout = undefined;
  }
}

function startTokenPolling() {
  stopTokenPolling();
  tokenPollAttempts = 0;
  logDebugMessage('log', 'TELEBIZ_AUTH: Starting token polling');

  tokenPollInterval = setInterval(() => {
    tokenPollAttempts++;
    logDebugMessage('debug', `TELEBIZ_AUTH: Token poll attempt ${tokenPollAttempts}/${TOKEN_POLL_MAX_ATTEMPTS}`);

    const global = getGlobal();
    const authStep = global.telebiz?.auth?.authStep;

    // Stop polling if we're no longer waiting for token
    if (authStep !== 'waiting_for_token') {
      logDebugMessage('log', 'TELEBIZ_AUTH: Stopping token polling - auth step changed to:', authStep);
      stopTokenPolling();
      return;
    }

    // Stop after max attempts
    if (tokenPollAttempts >= TOKEN_POLL_MAX_ATTEMPTS) {
      logDebugMessage('warn', 'TELEBIZ_AUTH: Token polling timed out');
      stopTokenPolling();
      return;
    }

    getActions().telebizCheckForToken();
  }, TOKEN_POLL_INTERVAL);
}

function stopTokenPolling() {
  if (tokenPollInterval) {
    clearInterval(tokenPollInterval);
    tokenPollInterval = undefined;
    tokenPollAttempts = 0;
  }
}

addActionHandler('telebizInitAuth', async (global): Promise<void> => {
  logDebugMessage('log', 'TELEBIZ_AUTH: Initializing authentication');

  const hasToken = telebizApiClient.getToken();
  logDebugMessage('log', 'TELEBIZ_AUTH: Has existing token:', Boolean(hasToken));

  if (!hasToken) {
    logDebugMessage('log', 'TELEBIZ_AUTH: No token found, showing welcome modal');
    global = getGlobal();
    global = updateTelebizAuth(global, {
      isAuthenticated: false,
      isLoading: false,
      isWelcomeModalOpen: true,
    });
    setGlobal(global);
    return;
  }

  try {
    logDebugMessage('log', 'TELEBIZ_AUTH: Validating existing authentication');
    if (telebizApiClient.isAuthenticated()) {
      logDebugMessage('log', 'TELEBIZ_AUTH: Token is valid, getting user data');
      const user = await telebizApiClient.getCurrentUser();
      global = getGlobal();
      global = updateTelebizAuth(global, {
        isAuthenticated: true,
        isLoading: false,
        user,
        authStep: 'authenticated',
      });
      setGlobal(global);
      logDebugMessage('log', 'TELEBIZ_AUTH: User authenticated successfully:', user.username);
      getActions().telebizLoadInitialData();
      scheduleTokenRefresh();
    } else {
      logDebugMessage('log', 'TELEBIZ_AUTH: Token expired, refreshing');
      await telebizApiClient.refreshAuthToken();
      const user = await telebizApiClient.getCurrentUser();
      global = getGlobal();
      global = updateTelebizAuth(global, {
        isAuthenticated: true,
        isLoading: false,
        user,
        authStep: 'authenticated',
      });
      setGlobal(global);
      logDebugMessage('log', 'TELEBIZ_AUTH: Token refreshed, user authenticated:', user.username);
      getActions().telebizLoadInitialData();
      scheduleTokenRefresh();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Init failed';
    logDebugMessage('error', 'TELEBIZ_AUTH: Initialization failed:', errorMessage);
    telebizApiClient.logout();
    global = getGlobal();
    global = updateTelebizAuth(global, {
      isAuthenticated: false,
      isLoading: false,
      isWelcomeModalOpen: true,
    });
    setGlobal(global);
  }
});

addActionHandler('telebizLogin', (global): void => {
  const authState = global.telebiz?.auth;
  if (authState?.isAuthenticated) {
    global = updateTelebizAuth(global, { isWelcomeModalOpen: false });
    setGlobal(global);
    return;
  }

  logDebugMessage('log', 'TELEBIZ_AUTH: Starting login process');

  // Clear any previously processed token to allow fresh login
  lastProcessedToken = undefined;

  const actions = getActions();

  if (!AUTH_BOT_USERNAME) {
    logDebugMessage('error', 'TELEBIZ_AUTH: AUTH_BOT_USERNAME is not set');
    return;
  }

  if (actions.openChatByUsername) {
    logDebugMessage('log', 'TELEBIZ_AUTH: Sending /start command to bot');
    actions.openChatByUsername({
      username: AUTH_BOT_USERNAME,
      startParam: 'start',
    });
    global = getGlobal();
    global = updateTelebizAuth(global, { authStep: 'waiting_for_token' });
    setGlobal(global);
    logDebugMessage('log', 'TELEBIZ_AUTH: Auth step set to waiting_for_token');

    // Start polling for JWT token as fallback (apiUpdate might not fire on first visit)
    startTokenPolling();
  } else {
    logDebugMessage('error', 'TELEBIZ_AUTH: Cannot send bot command - chat or action not available');
  }
});

addActionHandler('telebizProcessJWTToken', async (global, actions, payload): Promise<void> => {
  const { token } = payload;

  // Stop polling since we found a token
  stopTokenPolling();

  // Skip if this exact token was already processed (prevents race between apiUpdate and polling)
  if (lastProcessedToken === token) {
    logDebugMessage('warn', 'TELEBIZ_AUTH: Token already processed, skipping duplicate');
    return;
  }

  const authState = global.telebiz?.auth;
  // Skip if already processing or authenticated (prevents duplicate processing)
  if (authState?.authStep === 'processing_token' || authState?.isAuthenticated) {
    logDebugMessage('warn', 'TELEBIZ_AUTH: Already processing token or authenticated, skipping');
    return;
  }

  // Mark this token as being processed
  lastProcessedToken = token;

  logDebugMessage('log', 'TELEBIZ_AUTH: Starting JWT token processing');
  global = updateTelebizAuth(global, { authStep: 'processing_token' });
  setGlobal(global);

  try {
    logDebugMessage('log', 'TELEBIZ_AUTH: Authenticating with JWT token');
    const response = await telebizApiClient.authenticateWithJWT(token);

    logDebugMessage('log', 'TELEBIZ_AUTH: Authentication successful, user:', response.user.id);
    global = getGlobal();
    global = updateTelebizAuth(global, {
      isAuthenticated: true,
      isLoading: false,
      user: response.user,
      error: undefined,
      authStep: 'authenticated',
      isWelcomeModalOpen: false,
    });
    setGlobal(global);

    logDebugMessage('log', 'TELEBIZ_AUTH: Auth flow completed successfully');
    getActions().telebizLoadInitialData();
    scheduleTokenRefresh();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Auth failed';
    logDebugMessage('error', 'TELEBIZ_AUTH: Authentication failed:', errorMessage);

    // Clear processed token on failure so user can retry with same token if needed
    lastProcessedToken = undefined;

    global = getGlobal();
    global = updateTelebizAuth(global, {
      isAuthenticated: false,
      isLoading: false,
      error: errorMessage,
      authStep: 'idle',
      isWelcomeModalOpen: true,
    });
    setGlobal(global);
  }
});

addActionHandler('telebizCheckForToken', (global): void => {
  const authState = global.telebiz?.auth;
  if (authState?.authStep !== 'waiting_for_token') return;

  logDebugMessage('log', 'TELEBIZ_AUTH: Checking for JWT token');

  if (!AUTH_BOT_USERNAME) {
    logDebugMessage('error', 'TELEBIZ_AUTH: AUTH_BOT_USERNAME is not set');
    return;
  }

  const botChat = selectChatByUsername(global, AUTH_BOT_USERNAME);
  if (!botChat) {
    logDebugMessage('error', 'TELEBIZ_AUTH: Bot chat not found for token polling');
    return;
  }

  const botMessages = selectChatMessages(global, botChat.id);
  if (!botMessages) {
    logDebugMessage('error', 'TELEBIZ_AUTH: Bot messages not found for token polling');
    return;
  }

  const messages = Object.values(botMessages)
    .sort((a, b) => b.date - a.date)
    .slice(0, 5);

  logDebugMessage('debug', 'TELEBIZ_AUTH: Checking', messages.length, 'recent messages');

  for (const msg of messages) {
    const text = msg.content?.text?.text;
    if (!text) continue;

    const jwtMatch = text.match(/([A-Za-z0-9_-]{4,}\.)[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/);
    if (jwtMatch) {
      logDebugMessage('log', 'TELEBIZ_AUTH: JWT token found in message:', msg.id);
      getActions().telebizProcessJWTToken({ token: jwtMatch[0] });
      return;
    }
  }

  logDebugMessage('debug', 'TELEBIZ_AUTH: No JWT token found in recent messages');
});

addActionHandler('telebizLogout', async (global): Promise<void> => {
  logDebugMessage('log', 'TELEBIZ_AUTH: Logging out user');
  cancelTokenRefresh();
  await telebizApiClient.logout();

  global = getGlobal();
  global = updateTelebizAuth(global, {
    isAuthenticated: false,
    isLoading: false,
    user: undefined,
    authStep: 'idle',
    isWelcomeModalOpen: true,
  });
  setGlobal(global);
  logDebugMessage('log', 'TELEBIZ_AUTH: Logout completed');
});

addActionHandler('telebizRefreshToken', async (global): Promise<void> => {
  const authState = global.telebiz?.auth;
  if (!authState?.isAuthenticated) return;

  try {
    if (!telebizApiClient.isAuthenticated()) {
      logDebugMessage('log', 'TELEBIZ_AUTH: Token expired, attempting refresh');
      await telebizApiClient.refreshAuthToken();
      const user = await telebizApiClient.getCurrentUser();

      global = getGlobal();
      global = updateTelebizAuth(global, { user });
      setGlobal(global);
      logDebugMessage('log', 'TELEBIZ_AUTH: Token refresh successful');
    }
    scheduleTokenRefresh();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Token refresh failed';
    cancelTokenRefresh();
    logDebugMessage('error', 'TELEBIZ_AUTH: Token refresh failed:', errorMessage);

    global = getGlobal();
    global = updateTelebizAuth(global, {
      isAuthenticated: false,
      isLoading: false,
      user: undefined,
      error: errorMessage,
      isWelcomeModalOpen: true,
      authStep: 'idle',
    });
    setGlobal(global);
  }
});

addActionHandler('telebizLoadInitialData', (): void => {
  const {
    loadTelebizOrganizations,
    loadTelebizProviders,
    loadTelebizRelationships,
    loadTelebizNotificationCounts,
    loadTelebizTemplatesChats,
    loadTelebizUserRoles,
  } = getActions();

  logDebugMessage('log', 'TELEBIZ_AUTH: Loading initial data');
  loadTelebizOrganizations();
  loadTelebizProviders();
  loadTelebizRelationships();
  loadTelebizNotificationCounts();
  loadTelebizTemplatesChats();
  loadTelebizUserRoles();
});

addActionHandler('telebizClearAuthError', (global): ActionReturnType => {
  logDebugMessage('debug', 'TELEBIZ_AUTH: Clearing error state');
  return updateTelebizAuth(global, { error: undefined });
});

addActionHandler('telebizOpenWelcomeModal', (global): ActionReturnType => {
  return updateTelebizAuth(global, { isWelcomeModalOpen: true });
});

addActionHandler('telebizCloseWelcomeModal', (global): ActionReturnType => {
  const authState = global.telebiz?.auth;
  if (authState?.isAuthenticated) {
    return updateTelebizAuth(global, { isWelcomeModalOpen: false });
  }
  return global;
});
