import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import {
  ApiUpdate,
  ApiUpdateAuthorizationState,
  ApiUpdateAuthorizationError,
  ApiUpdateConnectionState,
  ApiUpdateSession,
  ApiUpdateCurrentUser, ApiUpdateServerTimeOffset,
} from '../../../api/types';
import { DEBUG, SESSION_USER_KEY } from '../../../config';
import { subscribe } from '../../../util/notifications';
import { updateUser } from '../../reducers';
import { setLanguage } from '../../../util/langProvider';
import { selectNotifySettings } from '../../selectors';

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
  if (DEBUG) {
    if (update['@type'] !== 'updateUserStatus' && update['@type'] !== 'updateServerTimeOffset') {
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

    case 'updateSession':
      onUpdateSession(update);
      break;

    case 'updateServerTimeOffset':
      onUpdateServerTimeOffset(update);
      break;

    case 'updateCurrentUser':
      onUpdateCurrentUser(update);
      break;

    case 'error':
      if (update.error.message === 'SESSION_REVOKED') {
        actions.signOut();
      }

      if (actions.showDialog) {
        actions.showDialog({ data: { ...update.error, hasErrorKey: true } });
      }

      break;
  }
});

function onUpdateApiReady(global: GlobalState) {
  const { hasWebNotifications, hasPushNotifications } = selectNotifySettings(global);
  if (hasWebNotifications && hasPushNotifications) subscribe();
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

function onUpdateSession(update: ApiUpdateSession) {
  const { sessionData } = update;
  const { authRememberMe, authState } = getGlobal();
  const isEmpty = !sessionData || !sessionData.mainDcId;

  if (!authRememberMe || authState !== 'authorizationStateReady' || isEmpty) {
    return;
  }

  getDispatch().saveSession({ sessionData });
}

function onUpdateServerTimeOffset(update: ApiUpdateServerTimeOffset) {
  const global = getGlobal();

  if (global.serverTimeOffset === update.serverTimeOffset) {
    return;
  }

  setGlobal({
    ...global,
    serverTimeOffset: update.serverTimeOffset,
  });
}

function onUpdateCurrentUser(update: ApiUpdateCurrentUser) {
  const { currentUser } = update;

  setGlobal({
    ...updateUser(getGlobal(), currentUser.id, currentUser),
    currentUserId: currentUser.id,
  });

  updateSessionUserId(currentUser.id);
}

function updateSessionUserId(currentUserId: number) {
  const sessionUserAuth = localStorage.getItem(SESSION_USER_KEY);
  if (!sessionUserAuth) return;

  const userAuth = JSON.parse(sessionUserAuth);
  userAuth.id = currentUserId;

  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userAuth));
}
