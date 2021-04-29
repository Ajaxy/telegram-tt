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
import { DEBUG } from '../../../config';
import { subscribeToPush } from '../../../util/pushNotifications';
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
  subscribeToPush();
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
      if (wasAuthReady) {
        break;
      }

      setGlobal({
        ...global,
        isLoggingOut: false,
        lastSyncTime: Date.now(),
      });

      const { sessionId } = update;
      if (sessionId && global.authRememberMe) {
        getDispatch().saveSession({ sessionId });
      }

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
}
