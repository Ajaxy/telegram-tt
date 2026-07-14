import type { InlineBotSettings } from '../../types';
import type { BrowserModalStateType, BrowserState, BrowserTab } from '../../types/browser';
import type { WebApp } from '../../types/webapp';
import type {
  GlobalState, TabArgs,
} from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import {
  getBrowserTabKey,
  getBrowserWebAppTabKey,
  selectTabBrowserState,
} from '../helpers/browser';
import { selectActiveWebApp, selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function replaceInlineBotSettings<T extends GlobalState>(
  global: T, username: string, inlineBotSettings: InlineBotSettings | false,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    inlineBots: {
      ...tabState.inlineBots,
      byUsername: {
        ...tabState.inlineBots.byUsername,
        [username]: inlineBotSettings,
      },
    },
  }, tabId);
}

export function replaceInlineBotsIsLoading<T extends GlobalState>(
  global: T, isLoading: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    inlineBots: {
      ...selectTabState(global, tabId).inlineBots,
      isLoading,
    },
  }, tabId);
}

export function updateWebApp<T extends GlobalState>(
  global: T, key: string, webAppUpdate: Partial<WebApp>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(currentTabState);
  const openedTabs = browser.openedTabs;

  const originalTab = openedTabs[key];

  if (!originalTab || originalTab.type !== 'webApp') return global;

  const updatedValue = {
    ...originalTab.webApp,
    ...webAppUpdate,
  };

  const updatedWebAppKey = getBrowserWebAppTabKey(updatedValue);
  if (!updatedWebAppKey) return global;

  const updatedOpenedTabs = {
    ...openedTabs,
  };
  delete updatedOpenedTabs[key];
  updatedOpenedTabs[updatedWebAppKey] = {
    type: 'webApp',
    webApp: updatedValue,
  };

  global = updateTabState(global, {
    browser: {
      ...browser,
      activeTabKey: browser.activeTabKey === key ? updatedWebAppKey : browser.activeTabKey,
      openedTabs: updatedOpenedTabs,
      openedOrderedKeys: browser.openedOrderedKeys.map((tabKey) => (tabKey === key ? updatedWebAppKey : tabKey)),
      sessionKeys: browser.sessionKeys.map((tabKey) => (tabKey === key ? updatedWebAppKey : tabKey)),
    },
  }, tabId);

  return global;
}

export function activateBrowserTabIfOpen<T extends GlobalState>(
  global: T, tabKey: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(currentTabState);

  if (!browser.openedTabs[tabKey]) {
    return global;
  }

  global = updateTabState(global, {
    browser: {
      ...browser,
      isMoreAppsTabActive: false,
      activeTabKey: tabKey,
      modalState: 'maximized',
    },
  }, tabId);

  return global;
}

export function addBrowserTabToOpenList<T extends GlobalState>(
  global: T, tab: BrowserTab,
  makeActive: boolean = true, openModalIfNotOpen: boolean = true,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(currentTabState);

  const key = getBrowserTabKey(tab);

  if (!key) return global;
  const newOpenedKeys = [...browser.openedOrderedKeys];
  if (!newOpenedKeys.includes(key)) newOpenedKeys.push(key);

  const newSessionKeys = [...browser.sessionKeys];
  if (!newSessionKeys.includes(key)) newSessionKeys.push(key);

  global = updateTabState(global, {
    browser: {
      ...browser,
      activeTabKey: makeActive ? key : browser.activeTabKey,
      isMoreAppsTabActive: false,
      isModalOpen: openModalIfNotOpen || browser.isModalOpen,
      modalState: 'maximized',
      openedTabs: {
        ...browser.openedTabs,
        [key]: tab,
      },
      openedOrderedKeys: newOpenedKeys,
      sessionKeys: newSessionKeys,
    },
  }, tabId);

  return global;
}

export function removeBrowserTabFromOpenList<T extends GlobalState>(
  global: T, key: string, skipClosingConfirmation?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(currentTabState);
  const { openedTabs, openedOrderedKeys, activeTabKey } = browser;
  const tab = openedTabs[key];
  if (!tab) return global;

  if (tab.type === 'webApp' && !skipClosingConfirmation && tab.webApp.shouldConfirmClosing) {
    return updateWebApp(global, key, { isCloseModalOpen: true }, tabId);
  }

  const updatedOpenedTabs = { ...openedTabs };
  delete updatedOpenedTabs[key];
  const newOpenedKeys = openedOrderedKeys.filter((tabKey) => tabKey !== key);
  const newSessionKeys = browser.sessionKeys.filter((tabKey) => updatedOpenedTabs[tabKey]);
  const isRemovedTabActive = activeTabKey === key;

  global = updateTabState(global, {
    browser: {
      ...browser,
      activeTabKey: getNextActiveTabKey(browser.activeTabKey, isRemovedTabActive, newOpenedKeys),
      openedTabs: updatedOpenedTabs,
      openedOrderedKeys: newOpenedKeys,
      sessionKeys: newSessionKeys,
    },
  }, tabId);

  return global;
}

export function clearOpenedBrowserTabs<T extends GlobalState>(
  global: T, force?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(currentTabState);

  if (force) {
    return clearAllOpenedBrowserTabs(global, browser, tabId);
  }

  const tabsNotAllowedToClose = Object.fromEntries(
    Object.entries(browser.openedTabs).filter(([, tab]) => {
      return tab.type === 'webApp' && tab.webApp.shouldConfirmClosing;
    }),
  ) as Record<string, BrowserTab>;

  const tabsNotAllowedToCloseEntries = Object.entries(tabsNotAllowedToClose);
  const hasNotAllowedToCloseTabs = tabsNotAllowedToCloseEntries.length > 0;

  if (!hasNotAllowedToCloseTabs) {
    return clearAllOpenedBrowserTabs(global, browser, tabId);
  }

  const currentActiveWebApp = selectActiveWebApp(global, tabId);

  const newActiveWebApp = currentActiveWebApp?.shouldConfirmClosing
    ? currentActiveWebApp : findFirstWebApp(tabsNotAllowedToCloseEntries);

  const newActiveWebAppKey = newActiveWebApp && getBrowserWebAppTabKey(newActiveWebApp);

  if (newActiveWebAppKey) {
    tabsNotAllowedToClose[newActiveWebAppKey] = {
      type: 'webApp',
      webApp: {
        ...newActiveWebApp,
        isCloseModalOpen: true,
      },
    };
  }
  const newOpenedKeys = browser.openedOrderedKeys.filter((tabKey) => tabsNotAllowedToClose[tabKey]);
  const newSessionKeys = browser.sessionKeys.filter((tabKey) => tabsNotAllowedToClose[tabKey]);

  return updateTabState(global, {
    browser: {
      ...browser,
      activeTabKey: newActiveWebAppKey,
      isMoreAppsTabActive: false,
      openedTabs: tabsNotAllowedToClose,
      openedOrderedKeys: newOpenedKeys,
      sessionKeys: newSessionKeys,
    },
  }, tabId);
}

export function hasOpenedBrowserTabs<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): boolean {
  return Object.keys(selectTabBrowserState(selectTabState(global, tabId)).openedTabs).length > 0;
}

export function hasBrowserTabsRequiringCloseConfirmation<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): boolean {
  return Object.values(selectTabBrowserState(selectTabState(global, tabId)).openedTabs).some((tab) => {
    return tab.type === 'webApp' && Boolean(tab.webApp.shouldConfirmClosing);
  });
}

export function replaceBrowserModalState<T extends GlobalState>(
  global: T, modalState: BrowserModalStateType,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(currentTabState);
  return updateTabState(global, {
    browser: {
      ...browser,
      modalState,
    },
  }, tabId);
}

export function replaceIsBrowserModalOpen<T extends GlobalState>(
  global: T, value: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const browser = selectTabBrowserState(currentTabState);
  return updateTabState(global, {
    browser: {
      ...browser,
      isModalOpen: value,
    },
  }, tabId);
}

function clearAllOpenedBrowserTabs<T extends GlobalState>(
  global: T, browser: BrowserState, tabId: number,
): T {
  return updateTabState(global, {
    browser: {
      ...browser,
      activeTabKey: undefined,
      isMoreAppsTabActive: false,
      openedTabs: {},
      openedOrderedKeys: [],
      sessionKeys: [],
    },
  }, tabId);
}

function findFirstWebApp(entries: [string, BrowserTab][]) {
  const entry = entries.find(([, tab]) => tab.type === 'webApp');
  const tab = entry?.[1];
  return tab?.type === 'webApp' ? tab.webApp : undefined;
}

function getNextActiveTabKey(
  activeTabKey: string | undefined, isRemovedTabActive: boolean, openedOrderedKeys: string[],
) {
  if (!isRemovedTabActive) return activeTabKey;

  return openedOrderedKeys.length ? openedOrderedKeys[openedOrderedKeys.length - 1] : undefined;
}
