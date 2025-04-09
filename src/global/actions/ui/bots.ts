import type { ApiChatType } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { getWebAppKey } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addWebAppToOpenList,
  clearOpenedWebApps,
  hasOpenedMoreThanOneWebApps,
  hasOpenedWebApps,
  removeActiveWebAppFromOpenList,
  removeWebAppFromOpenList,
  replaceIsWebAppModalOpen,
  replaceWebAppModalState,
  updateWebApp,
} from '../../reducers/bots';
import { updateTabState } from '../../reducers/tabs';
import {
  selectActiveWebApp, selectCurrentMessageList, selectTabState, selectWebApp,
} from '../../selectors';

addActionHandler('openWebAppTab', (global, actions, payload): ActionReturnType => {
  const {
    webApp, tabId = getCurrentTabId(),
  } = payload;

  if (!webApp) return;

  global = getGlobal();
  global = addWebAppToOpenList(global, webApp, true, true, tabId);
  setGlobal(global);
});

addActionHandler('updateWebApp', (global, actions, payload): ActionReturnType => {
  const {
    key, update, tabId = getCurrentTabId(),
  } = payload;
  return updateWebApp(global, key, update, tabId);
});

addActionHandler('closeActiveWebApp', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  global = removeActiveWebAppFromOpenList(global, tabId);
  if (!hasOpenedWebApps(global, tabId)) return replaceIsWebAppModalOpen(global, false, tabId);

  return global;
});

addActionHandler('openMoreAppsTab', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  global = updateTabState(global, {
    webApps: {
      ...tabState.webApps,
      activeWebAppKey: undefined,
      isMoreAppsTabActive: true,
    },
  }, tabId);

  return global;
});

addActionHandler('closeMoreAppsTab', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);

  const openedWebApps = tabState.webApps.openedWebApps;

  const openedWebAppsKeys = Object.keys(openedWebApps);
  const openedWebAppsCount = openedWebAppsKeys.length;

  global = updateTabState(global, {
    webApps: {
      ...tabState.webApps,
      isMoreAppsTabActive: false,
      activeWebAppKey: openedWebAppsCount ? openedWebAppsKeys[openedWebAppsCount - 1] : undefined,
      isModalOpen: openedWebAppsCount > 0,
    },
  }, tabId);

  return global;
});

addActionHandler('closeWebApp', (global, actions, payload): ActionReturnType => {
  const { key, skipClosingConfirmation, tabId = getCurrentTabId() } = payload || {};

  global = removeWebAppFromOpenList(global, key, skipClosingConfirmation, tabId);
  if (!hasOpenedWebApps(global, tabId)) return replaceIsWebAppModalOpen(global, false, tabId);

  return global;
});

addActionHandler('closeWebAppModal', (global, actions, payload): ActionReturnType => {
  const { shouldSkipConfirmation, tabId = getCurrentTabId() } = payload || {};

  const shouldShowConfirmation = !shouldSkipConfirmation
  && !global.settings.byKey.shouldSkipWebAppCloseConfirmation && hasOpenedMoreThanOneWebApps(global, tabId);

  if (shouldShowConfirmation) {
    actions.openWebAppsCloseConfirmationModal({ tabId });
    return global;
  }

  global = clearOpenedWebApps(global, tabId);
  if (!hasOpenedWebApps(global, tabId)) return replaceIsWebAppModalOpen(global, false, tabId);

  return global;
});

addActionHandler('changeWebAppModalState', (global, actions, payload): ActionReturnType => {
  const { state, tabId = getCurrentTabId() } = payload;

  return replaceWebAppModalState(global, state, tabId);
});

addActionHandler('updateMiniAppCachedPosition', (global, actions, payload): ActionReturnType => {
  const { position } = payload;

  global = {
    ...global,
    settings: {
      ...global.settings,
      miniAppsCachedPosition: position,
    },
  };

  return global;
});

addActionHandler('updateMiniAppCachedSize', (global, actions, payload): ActionReturnType => {
  const { size } = payload;

  global = {
    ...global,
    settings: {
      ...global.settings,
      miniAppsCachedSize: size,
    },
  };

  return global;
});

addActionHandler('setWebAppPaymentSlug', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload;
  const activeWebApp = selectActiveWebApp(global, tabId);
  if (!activeWebApp?.url) return undefined;

  const key = getWebAppKey(activeWebApp);

  return updateWebApp(global, key, { slug: payload.slug }, tabId);
});

addActionHandler('cancelBotTrustRequest', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    botTrustRequest: undefined,
  }, tabId);
});

addActionHandler('markBotTrusted', (global, actions, payload): ActionReturnType => {
  const { botId, isWriteAllowed, tabId = getCurrentTabId() } = payload;
  const { trustedBotIds } = global;

  const newTrustedBotIds = new Set(trustedBotIds);
  newTrustedBotIds.add(botId);

  global = {
    ...global,
    trustedBotIds: Array.from(newTrustedBotIds),
  };

  const tabState = selectTabState(global, tabId);
  if (tabState.botTrustRequest?.onConfirm) {
    const { action, payload: callbackPayload } = tabState.botTrustRequest.onConfirm;
    // @ts-ignore
    actions[action]({
      ...(callbackPayload as {}),
      isWriteAllowed,
    });
  }

  global = updateTabState(global, {
    botTrustRequest: undefined,
  }, tabId);

  setGlobal(global);
});

addActionHandler('sendWebAppEvent', (global, actions, payload): ActionReturnType => {
  const { event, webAppKey, tabId = getCurrentTabId() } = payload;
  const webApp = selectWebApp(global, webAppKey, tabId);
  if (!webApp) return global;

  const newPlannedEvents = webApp.plannedEvents ? [...webApp.plannedEvents, event] : [event];

  actions.updateWebApp({
    key: webAppKey,
    update: {
      plannedEvents: newPlannedEvents,
    },
    tabId,
  });

  return global;
});

addActionHandler('cancelAttachBotInstall', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    requestedAttachBotInstall: undefined,
  }, tabId);
});

addActionHandler('requestAttachBotInChat', (global, actions, payload): ActionReturnType => {
  const {
    bot, filter, startParam, tabId = getCurrentTabId(),
  } = payload;
  const currentChatId = selectCurrentMessageList(global, tabId)?.chatId;

  const supportedFilters = bot.attachMenuPeerTypes?.filter((type): type is ApiChatType => (
    type !== 'self' && filter.includes(type)
  ));

  if (!supportedFilters?.length) {
    actions.callAttachBot({
      chatId: currentChatId || bot.id,
      bot,
      startParam,
      tabId,
    });
    return;
  }

  global = updateTabState(global, {
    requestedAttachBotInChat: {
      bot,
      filter: supportedFilters,
      startParam,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('cancelAttachBotInChat', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    requestedAttachBotInChat: undefined,
  }, tabId);
});

addActionHandler('openEmojiStatusAccessModal', (global, actions, payload): ActionReturnType => {
  const {
    bot, webAppKey, tabId = getCurrentTabId(),
  } = payload;

  if (!bot || !webAppKey) return;

  global = getGlobal();
  global = updateTabState(global, {
    emojiStatusAccessModal: {
      bot,
      webAppKey,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('closeEmojiStatusAccessModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    emojiStatusAccessModal: undefined,
  }, tabId);
});

addActionHandler('openLocationAccessModal', (global, actions, payload): ActionReturnType => {
  const {
    bot, webAppKey, tabId = getCurrentTabId(),
  } = payload;

  if (!bot || !webAppKey) return;

  global = getGlobal();
  global = updateTabState(global, {
    locationAccessModal: {
      bot,
      webAppKey,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('closeLocationAccessModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    locationAccessModal: undefined,
  }, tabId);
});
