import type { ApiChatType } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { selectTabBrowserState } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateSharedSettings } from '../../reducers';
import {
  addBrowserTabToOpenList,
  clearOpenedBrowserTabs,
  hasBrowserTabsRequiringCloseConfirmation,
  hasOpenedBrowserTabs,
  removeBrowserTabFromOpenList,
  replaceBrowserModalState,
  replaceIsBrowserModalOpen,
  updateWebApp,
} from '../../reducers/bots';
import { updateTabState } from '../../reducers/tabs';
import { selectCurrentMessageList, selectTabState, selectWebApp } from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';

addActionHandler('openBrowserTab', (global, actions, payload): ActionReturnType => {
  const {
    tab, tabId = getCurrentTabId(),
  } = payload;

  if (!tab) return;

  global = getGlobal();
  global = addBrowserTabToOpenList(global, tab, true, true, tabId);
  setGlobal(global);
});

addActionHandler('updateWebApp', (global, actions, payload): ActionReturnType => {
  const {
    key, update, tabId = getCurrentTabId(),
  } = payload;
  return updateWebApp(global, key, update, tabId);
});

addActionHandler('openMoreAppsTab', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(tabState);
  global = updateTabState(global, {
    browser: {
      ...browser,
      activeTabKey: undefined,
      isMoreAppsTabActive: true,
    },
  }, tabId);

  return global;
});

addActionHandler('closeMoreAppsTab', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(tabState);

  const openedTabs = browser.openedTabs;

  const openedTabsKeys = browser.openedOrderedKeys.filter((key) => openedTabs[key]);
  const openedTabsCount = openedTabsKeys.length;

  global = updateTabState(global, {
    browser: {
      ...browser,
      isMoreAppsTabActive: false,
      activeTabKey: openedTabsCount ? openedTabsKeys[openedTabsCount - 1] : undefined,
      isModalOpen: openedTabsCount > 0,
    },
  }, tabId);

  return global;
});

addActionHandler('closeBrowserTab', (global, actions, payload): ActionReturnType => {
  const { key, skipClosingConfirmation, tabId = getCurrentTabId() } = payload || {};

  global = removeBrowserTabFromOpenList(global, key, skipClosingConfirmation, tabId);
  if (!hasOpenedBrowserTabs(global, tabId)) return replaceIsBrowserModalOpen(global, false, tabId);

  return global;
});

addActionHandler('closeBrowserModal', (global, actions, payload): ActionReturnType => {
  const { shouldSkipConfirmation, tabId = getCurrentTabId() } = payload || {};
  const shouldSkipBrowserConfirmation = Boolean(
    shouldSkipConfirmation || selectSharedSettings(global).shouldSkipBrowserCloseConfirmation,
  );

  const shouldShowConfirmation = !shouldSkipBrowserConfirmation
    && hasBrowserTabsRequiringCloseConfirmation(global, tabId);

  if (shouldShowConfirmation) {
    actions.openBrowserCloseConfirmationModal({ tabId });
    return global;
  }

  global = clearOpenedBrowserTabs(global, shouldSkipBrowserConfirmation, tabId);
  if (!hasOpenedBrowserTabs(global, tabId)) return replaceIsBrowserModalOpen(global, false, tabId);

  return global;
});

addActionHandler('changeBrowserModalState', (global, actions, payload): ActionReturnType => {
  const { state, tabId = getCurrentTabId() } = payload;

  return replaceBrowserModalState(global, state, tabId);
});

addActionHandler('updateBrowserCachedPosition', (global, actions, payload): ActionReturnType => {
  const { position } = payload;

  global = updateSharedSettings(global, {
    browserCachedPosition: position,
  });
  return global;
});

addActionHandler('updateBrowserCachedSize', (global, actions, payload): ActionReturnType => {
  const { size } = payload;

  global = updateSharedSettings(global, {
    browserCachedSize: size,
  });

  return global;
});

addActionHandler('setWebAppPaymentSlug', (global, actions, payload): ActionReturnType => {
  const { key, tabId = getCurrentTabId() } = payload;
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
    // @ts-expect-error -- No idea how to type this properly
    actions[action]({
      ...(callbackPayload),
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
    requestedBotStartGroup: undefined,
  }, tabId);
  setGlobal(global);
});

addActionHandler('cancelAttachBotInChat', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    requestedAttachBotInChat: undefined,
  }, tabId);
});

addActionHandler('requestBotStartGroup', (global, actions, payload): ActionReturnType => {
  const {
    bot, startParam, tabId = getCurrentTabId(),
  } = payload;
  return updateTabState(global, {
    requestedAttachBotInChat: undefined,
    requestedBotStartGroup: {
      bot,
      startParam,
    },
  }, tabId);
});

addActionHandler('cancelBotStartGroup', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    requestedBotStartGroup: undefined,
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
