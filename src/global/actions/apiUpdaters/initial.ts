import type { RequiredGlobalActions } from '../../index';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';

import type { ActionReturnType, GlobalState } from '../../types';

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
import { selectTabState, selectNotifySettings } from '../../selectors';
import { forceWebsync } from '../../../util/websync';
import { getShippingError, shouldClosePaymentModal } from '../../../util/getReadableErrorText';
import { clearWebTokenAuth } from '../../../util/routing';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { updateTabState } from '../../reducers/tabs';
import { setServerTimeOffset } from '../../../util/serverTime';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateApiReady':
      onUpdateApiReady(global);
      break;

    case 'updateAuthorizationState':
      onUpdateAuthorizationState(global, update);
      break;

    case 'updateAuthorizationError':
      onUpdateAuthorizationError(global, update);
      break;

    case 'updateWebAuthTokenFailed':
      onUpdateWebAuthTokenFailed(global);
      break;

    case 'updateConnectionState':
      onUpdateConnectionState(global, actions, update);
      break;

    case 'updateSession':
      onUpdateSession(global, actions, update);
      break;

    case 'updateServerTimeOffset':
      onUpdateServerTimeOffset(update);
      break;

    case 'updateCurrentUser':
      onUpdateCurrentUser(global, update);
      break;

    case 'error': {
      if (update.error.message === 'SESSION_REVOKED') {
        actions.signOut({ forceInitApi: true });
      }

      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        const paymentShippingError = getShippingError(update.error);
        if (paymentShippingError) {
          actions.addPaymentError({ error: paymentShippingError, tabId });
        } else if (shouldClosePaymentModal(update.error)) {
          actions.closePaymentModal({ tabId });
        } else if (actions.showDialog) {
          actions.showDialog({ data: update.error, tabId });
        }
      });

      break;
    }
  }
});

function onUpdateApiReady<T extends GlobalState>(global: T) {
  const { hasWebNotifications, hasPushNotifications } = selectNotifySettings(global);
  if (hasWebNotifications && hasPushNotifications) {
    void subscribe();
  }
  void setLanguage(global.settings.byKey.language);
}

function onUpdateAuthorizationState<T extends GlobalState>(global: T, update: ApiUpdateAuthorizationState) {
  global = getGlobal();

  const wasAuthReady = global.authState === 'authorizationStateReady';
  const authState = update.authorizationState;

  global = {
    ...global,
    authState,
    authIsLoading: false,
  };
  setGlobal(global);

  global = getGlobal();

  switch (authState) {
    case 'authorizationStateLoggingOut':
      void forceWebsync(false);

      global = {
        ...global,
        isLoggingOut: true,
      };
      setGlobal(global);
      break;
    case 'authorizationStateWaitCode':
      global = {
        ...global,
        authIsCodeViaApp: update.isCodeViaApp,
      };
      setGlobal(global);
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
      global = {
        ...global,
        authIsLoadingQrCode: false,
        authQrCode: update.qrCode,
      };
      setGlobal(global);
      break;
    case 'authorizationStateReady': {
      if (wasAuthReady) {
        break;
      }

      void forceWebsync(true);

      global = {
        ...global,
        isLoggingOut: false,
      };
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        global = updateTabState(global, {
          isInactive: false,
        }, tabId);
      });
      setGlobal(global);

      break;
    }
  }
}

function onUpdateAuthorizationError<T extends GlobalState>(global: T, update: ApiUpdateAuthorizationError) {
  global = getGlobal();
  global = {
    ...global,
    authError: update.message,
  };
  setGlobal(global);
}

function onUpdateWebAuthTokenFailed<T extends GlobalState>(global: T) {
  clearWebTokenAuth();
  global = getGlobal();

  global = {
    ...global,
    hasWebAuthTokenFailed: true,
  };
  setGlobal(global);
}

function onUpdateConnectionState<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, update: ApiUpdateConnectionState,
) {
  const { connectionState } = update;

  global = getGlobal();
  const tabState = selectTabState(global, getCurrentTabId());
  if (connectionState === 'connectionStateReady' && tabState.isMasterTab && tabState.multitabNextAction) {
    // @ts-ignore
    actions[tabState.multitabNextAction.action](tabState.multitabNextAction.payload);
    actions.clearMultitabNextAction({ tabId: tabState.id });
  }

  if (connectionState === global.connectionState) {
    return;
  }

  global = {
    ...global,
    connectionState,
  };
  setGlobal(global);

  if (connectionState === 'connectionStateBroken') {
    actions.signOut({ forceInitApi: true });
  }
}

function onUpdateSession<T extends GlobalState>(global: T, actions: RequiredGlobalActions, update: ApiUpdateSession) {
  const { sessionData } = update;
  global = getGlobal();
  const { authRememberMe, authState } = global;
  const isEmpty = !sessionData || !sessionData.mainDcId;

  if (!authRememberMe || authState !== 'authorizationStateReady' || isEmpty) {
    return;
  }

  actions.saveSession({ sessionData });
}

function onUpdateServerTimeOffset(update: ApiUpdateServerTimeOffset) {
  setServerTimeOffset(update.serverTimeOffset);
}

function onUpdateCurrentUser<T extends GlobalState>(global: T, update: ApiUpdateCurrentUser) {
  const { currentUser } = update;

  global = {
    ...updateUser(global, currentUser.id, currentUser),
    currentUserId: currentUser.id,
  };
  setGlobal(global);

  updateSessionUserId(currentUser.id);
}

function updateSessionUserId(currentUserId: string) {
  const sessionUserAuth = localStorage.getItem(SESSION_USER_KEY);
  if (!sessionUserAuth) return;

  const userAuth = JSON.parse(sessionUserAuth);
  userAuth.id = currentUserId;

  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userAuth));
}
