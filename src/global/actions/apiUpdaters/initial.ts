import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';

import type { GlobalState } from '../../types';

import type {
  ApiUpdateAuthorizationState,
  ApiUpdateAuthorizationError,
  ApiUpdateConnectionState,
  ApiUpdateSession,
  ApiUpdateCurrentUser, ApiUpdateServerTimeOffset,
} from '../../../api/types';
import { SESSION_USER_KEY } from '../../../config';
import { subscribe } from '../../../util/notifications';
import { updateUser } from '../../reducers';
import { setLanguage } from '../../../util/langProvider';
import { selectNotifySettings } from '../../selectors';
import { forceWebsync } from '../../../util/websync';
import { getShippingError, shouldClosePaymentModal } from '../../../util/getReadableErrorText';
import { clearWebTokenAuth } from '../../../util/routing';

addActionHandler('apiUpdate', (global, actions, update) => {
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

    case 'updateWebAuthTokenFailed':
      onUpdateWebAuthTokenFailed();
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

    case 'error': {
      if (update.error.message === 'SESSION_REVOKED') {
        actions.signOut();
      }

      const paymentShippingError = getShippingError(update.error);
      if (paymentShippingError) {
        actions.addPaymentError({ error: paymentShippingError });
      } else if (shouldClosePaymentModal(update.error)) {
        actions.closePaymentModal();
      } else if (actions.showDialog) {
        actions.showDialog({ data: update.error });
      }

      break;
    }
  }
});

function onUpdateApiReady(global: GlobalState) {
  const { hasWebNotifications, hasPushNotifications } = selectNotifySettings(global);
  if (hasWebNotifications && hasPushNotifications) {
    void subscribe();
  }
  void setLanguage(global.settings.byKey.language);
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
      void forceWebsync(false);

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
      global = {
        ...global,
        authHint: update.hint,
      };

      if (update.noReset) {
        global = {
          ...global,
          hasWebAuthTokenPasswordRequired: true,
        };
      }

      setGlobal(global);
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

      void forceWebsync(true);

      setGlobal({
        ...global,
        isLoggingOut: false,
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

function onUpdateWebAuthTokenFailed() {
  clearWebTokenAuth();

  setGlobal({
    ...getGlobal(),
    hasWebAuthTokenFailed: true,
  });
}

function onUpdateConnectionState(update: ApiUpdateConnectionState) {
  const { connectionState } = update;
  const global = getGlobal();

  if (connectionState === global.connectionState) {
    return;
  }

  setGlobal({
    ...global,
    connectionState,
  });

  if (connectionState === 'connectionStateBroken') {
    // When mounting Auth `initApi` will be called from an effect. Otherwise, we force it here.
    const isOnAuth = !global.authState || [
      'authorizationStateWaitPhoneNumber',
      'authorizationStateWaitCode',
      'authorizationStateWaitPassword',
      'authorizationStateWaitRegistration',
      'authorizationStateWaitQrCode',
    ].includes(global.authState);

    getActions().signOut({ forceInitApi: isOnAuth });
  }
}

function onUpdateSession(update: ApiUpdateSession) {
  const { sessionData } = update;
  const { authRememberMe, authState } = getGlobal();
  const isEmpty = !sessionData || !sessionData.mainDcId;

  if (!authRememberMe || authState !== 'authorizationStateReady' || isEmpty) {
    return;
  }

  getActions().saveSession({ sessionData });
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

function updateSessionUserId(currentUserId: string) {
  const sessionUserAuth = localStorage.getItem(SESSION_USER_KEY);
  if (!sessionUserAuth) return;

  const userAuth = JSON.parse(sessionUserAuth);
  userAuth.id = currentUserId;

  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userAuth));
}
