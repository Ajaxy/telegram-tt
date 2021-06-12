import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import {
  ApiUpdate,
  ApiUpdateAuthorizationState,
  ApiUpdateAuthorizationError,
  ApiUpdateConnectionState,
  ApiUpdateCurrentUser,
} from '../../../api/types';
import { DEBUG, LEGACY_SESSION_KEY } from '../../../config';
import { subscribe } from '../../../util/notifications';
import { updateUser } from '../../reducers';
import { setLanguage } from '../../../util/langProvider';

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
  if (DEBUG) {
    if (update['@type'] !== 'updateUserStatus') {
      // eslint-disable-next-line no-console
      console.log('[GramJs] UPDATE', update['@type'], { update });
    }
  }

  switch (update['@type']) {
    case 'updateApiReady':
      onUpdateApiReady(global);
      break;

    case 'updateAuthorizationState':
      onUpdateAuthorizationState(update);
      break;

    case 'updateAuthorizationError':
      onUpdateAuthorizationError(update);
      break;

    case 'updateConnectionState':
      onUpdateConnectionState(update);
      break;

    case 'updateCurrentUser':
      onUpdateCurrentUser(update);
      break;

    case 'error':
      if (update.error.message === 'SESSION_REVOKED') {
        actions.signOut();
      }

      actions.showError({ error: update.error });

      break;
  }
});

function onUpdateApiReady(global: GlobalState) {
  subscribe();
  setLanguage(global.settings.byKey.language);
}

function onUpdateAuthorizationState(update: ApiUpdateAuthorizationState) {
  let global = getGlobal();

  const wasAuthReady = global.authState === 'authorizationStateReady';
  const authState = update.authorizationState;

  setGlobal({
    ...global,
    authState,
    authIsLoading: false,
  });

  global = getGlobal();

  switch (authState) {
    case 'authorizationStateLoggingOut':
      setGlobal({
        ...global,
        isLoggingOut: true,
      });
      break;
    case 'authorizationStateWaitCode':
      setGlobal({
        ...global,
        authIsCodeViaApp: update.isCodeViaApp,
      });
      break;
    case 'authorizationStateWaitPassword':
      setGlobal({
        ...global,
        authHint: update.hint,
      });
      break;
    case 'authorizationStateWaitQrCode':
      setGlobal({
        ...global,
        authIsLoadingQrCode: false,
        authQrCode: update.qrCode,
      });
      break;
    case 'authorizationStateReady': {
      const { sessionId, sessionJson } = update;
      if (sessionId && global.authRememberMe) {
        getDispatch().saveSession({ sessionId, sessionJson });
      }

      if (wasAuthReady) {
        break;
      }

      setGlobal({
        ...global,
        isLoggingOut: false,
        lastSyncTime: Date.now(),
      });

      break;
    }
  }
}

function onUpdateAuthorizationError(update: ApiUpdateAuthorizationError) {
  setGlobal({
    ...getGlobal(),
    authError: update.message,
  });
}

function onUpdateConnectionState(update: ApiUpdateConnectionState) {
  const { connectionState } = update;
  const global = getGlobal();

  setGlobal({
    ...global,
    connectionState,
  });

  if (connectionState === 'connectionStateReady' && global.authState === 'authorizationStateReady') {
    getDispatch().sync();
  } else if (connectionState === 'connectionStateBroken') {
    getDispatch().signOut();
  }
}

function onUpdateCurrentUser(update: ApiUpdateCurrentUser) {
  const { currentUser } = update;

  setGlobal({
    ...updateUser(getGlobal(), currentUser.id, currentUser),
    currentUserId: currentUser.id,
  });

  updateLegacySessionUserId(currentUser.id);
}

function updateLegacySessionUserId(currentUserId: number) {
  const legacySessionJson = localStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacySessionJson) return;

  const legacySession = JSON.parse(legacySessionJson);
  legacySession.id = currentUserId;

  localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(legacySession));
}
