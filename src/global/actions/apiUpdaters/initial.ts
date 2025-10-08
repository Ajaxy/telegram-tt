import type {
  ApiUpdateAuthorizationError,
  ApiUpdateAuthorizationState,
  ApiUpdateConnectionState,
  ApiUpdateCurrentUser,
  ApiUpdateServerTimeOffset,
  ApiUpdateSession,
} from '../../../api/types';
import type { LangCode } from '../../../types';
import type { RequiredGlobalActions } from '../../index';
import type { ActionReturnType, GlobalState } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { getShippingError, shouldClosePaymentModal } from '../../../util/getReadableErrorText';
import { unique } from '../../../util/iteratees';
import { oldSetLanguage } from '../../../util/oldLangProvider';
import { clearWebTokenAuth } from '../../../util/routing';
import { setServerTimeOffset } from '../../../util/serverTime';
import { updateSessionUserId } from '../../../util/sessions';
import { forceWebsync } from '../../../util/websync';
import { isChatChannel, isChatSuperGroup } from '../../helpers';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import { updateUser, updateUserFullInfo } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';

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

    case 'requestReconnectApi':
      global = { ...global, isSynced: false };
      setGlobal(global);

      onUpdateConnectionState(global, actions, {
        '@type': 'updateConnectionState',
        connectionState: 'connectionStateConnecting',
      });
      actions.initApi();
      break;

    case 'requestSync':
      actions.sync();
      break;

    case 'updateFetchingDifference':
      global = { ...global, isFetchingDifference: update.isFetching };
      setGlobal(global);
      break;

    case 'error': {
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

    case 'notSupportedInFrozenAccount': {
      actions.showNotification({
        title: {
          key: 'NotificationTitleNotSupportedInFrozenAccount',
        },
        message: {
          key: 'NotificationMessageNotSupportedInFrozenAccount',
        },
        tabId: getCurrentTabId(),
      });
      break;
    }
  }
});

function onUpdateApiReady<T extends GlobalState>(global: T) {
  void oldSetLanguage(selectSharedSettings(global).language as LangCode);
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
          inactiveReason: undefined,
        }, tabId);
      });
      setGlobal(global);

      break;
    }
  }
}

function onUpdateAuthorizationError<T extends GlobalState>(global: T, update: ApiUpdateAuthorizationError) {
  // TODO: Investigate why TS is not happy with spread for lang related types
  global = {
    ...global,
  };
  global.authErrorKey = update.errorKey;
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

  if (global.isSynced) {
    const channelStackIds = Object.values(global.byTabId)
      .flatMap((tab) => tab.messageLists)
      .map((messageList) => messageList.chatId)
      .filter((chatId) => {
        const chat = global.chats.byId[chatId];
        return chat && (isChatChannel(chat) || isChatSuperGroup(chat));
      });
    if (connectionState === 'connectionStateReady' && channelStackIds.length) {
      unique(channelStackIds).forEach((chatId) => {
        actions.requestChannelDifference({ chatId });
      });
    }
  }

  if (connectionState === 'connectionStateBroken') {
    actions.signOut({ forceInitApi: true });
  }
}

function onUpdateSession<T extends GlobalState>(global: T, actions: RequiredGlobalActions, update: ApiUpdateSession) {
  const { sessionData } = update;
  const { authRememberMe, authState } = global;
  const isEmpty = !sessionData || !sessionData.mainDcId;

  const isTest = sessionData?.isTest;
  if (isTest) {
    global = {
      ...global,
      config: {
        ...global.config,
        isTestServer: isTest,
      },
    };
    setGlobal(global);
  }

  if (!authRememberMe || authState !== 'authorizationStateReady' || isEmpty) {
    return;
  }

  actions.saveSession({ sessionData });
}

function onUpdateServerTimeOffset(update: ApiUpdateServerTimeOffset) {
  setServerTimeOffset(update.serverTimeOffset);
}

function onUpdateCurrentUser<T extends GlobalState>(global: T, update: ApiUpdateCurrentUser) {
  const { currentUser, currentUserFullInfo } = update;

  global = {
    ...updateUser(global, currentUser.id, currentUser),
    currentUserId: currentUser.id,
  };
  global = updateUserFullInfo(global, currentUser.id, currentUserFullInfo);
  setGlobal(global);

  updateSessionUserId(currentUser.id);
}
