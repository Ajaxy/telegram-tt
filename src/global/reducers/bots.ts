import type { InlineBotSettings } from '../../types';
import type {
  GlobalState, TabArgs, WebApp, WebAppModalStateType,
} from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { getWebAppKey } from '../helpers/bots';
import { selectTabState } from '../selectors';
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

export function updateWebApp <T extends GlobalState>(
  global: T, key: string, webAppUpdate: Partial<WebApp>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const openedWebApps = currentTabState.webApps.openedWebApps;

  const originalWebApp = openedWebApps[key];

  if (!originalWebApp) return global;

  const updatedValue = {
    ...originalWebApp,
    ...webAppUpdate,
  };

  const updatedWebAppKey = getWebAppKey(updatedValue);
  if (!updatedWebAppKey) return global;

  const activeWebApp = currentTabState.webApps.activeWebApp;
  const activeWebAppKey = activeWebApp && getWebAppKey(activeWebApp);
  global = updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      ...updatedWebAppKey === activeWebAppKey && {
        activeWebApp: updatedValue,
      },
      openedWebApps: {
        ...openedWebApps,
        [updatedWebAppKey]: updatedValue,
      },
    },
  }, tabId);

  return global;
}

export function activateWebAppIfOpen<T extends GlobalState>(
  global: T, webAppKey: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const openedWebApps = currentTabState.webApps.openedWebApps;

  if (!openedWebApps[webAppKey]) {
    return global;
  }

  const newActiveWebApp = openedWebApps[webAppKey];

  global = updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      isMoreAppsTabActive: false,
      activeWebApp: newActiveWebApp,
      modalState: 'maximized',
    },
  }, tabId);

  return global;
}

export function addWebAppToOpenList<T extends GlobalState>(
  global: T, webApp: WebApp,
  makeActive: boolean = true, openModalIfNotOpen: boolean = true,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);

  const key = getWebAppKey(webApp);

  if (!key) return global;
  const newOpenedKeys = [...currentTabState.webApps.openedOrderedKeys];
  if (!newOpenedKeys.includes(key)) newOpenedKeys.push(key);

  const newSessionKeys = [...currentTabState.webApps.sessionKeys];
  if (!newSessionKeys.includes(key)) newSessionKeys.push(key);

  const openedWebApps = currentTabState.webApps.openedWebApps;

  global = updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      ...makeActive && { activeWebApp: webApp },
      isMoreAppsTabActive: false,
      isModalOpen: openModalIfNotOpen,
      modalState: 'maximized',
      openedWebApps: {
        ...openedWebApps,
        [key]: webApp,
      },
      openedOrderedKeys: newOpenedKeys,
      sessionKeys: newSessionKeys,
    },
  }, tabId);

  return global;
}

export function removeActiveWebAppFromOpenList<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);

  if (!currentTabState.webApps.activeWebApp) return global;

  const key = getWebAppKey(currentTabState.webApps.activeWebApp);

  return removeWebAppFromOpenList(global, key, false, tabId);
}

export function removeWebAppFromOpenList<T extends GlobalState>(
  global: T, key: string, skipClosingConfirmation?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const openedWebApps = currentTabState.webApps.openedWebApps;
  const webApp = openedWebApps[key];
  if (!webApp) return global;

  if (!skipClosingConfirmation && webApp.shouldConfirmClosing) {
    return updateWebApp(global, key, { isCloseModalOpen: true }, tabId);
  }

  const updatedOpenedWebApps = { ...openedWebApps };
  const removingWebAppKey = getWebAppKey(webApp);

  let newOpenedKeys = currentTabState.webApps.openedOrderedKeys;

  if (removingWebAppKey) {
    delete updatedOpenedWebApps[removingWebAppKey];
    newOpenedKeys = currentTabState.webApps.openedOrderedKeys.filter((k) => k !== removingWebAppKey);
  }

  const activeWebApp = currentTabState.webApps.activeWebApp;

  const isRemovedAppActive = activeWebApp && (getWebAppKey(activeWebApp) === getWebAppKey(webApp));

  const openedWebAppsValues = Object.values(updatedOpenedWebApps);
  const openedWebAppsCount = openedWebAppsValues.length;

  global = updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      ...isRemovedAppActive && {
        activeWebApp: openedWebAppsCount
          ? openedWebAppsValues[openedWebAppsCount - 1] : undefined,
      },
      openedWebApps: updatedOpenedWebApps,
      openedOrderedKeys: newOpenedKeys,
      ...!openedWebAppsCount && {
        sessionKeys: [],
      },
    },
  }, tabId);

  return global;
}

export function clearOpenedWebApps<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);

  const webAppsNotAllowedToClose = Object.fromEntries(
    Object.entries(currentTabState.webApps.openedWebApps).filter(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([url, webApp]) => webApp.shouldConfirmClosing,
    ),
  );

  const webAppsNotAllowedToCloseValues = Object.values(webAppsNotAllowedToClose);
  const hasNotAllowedToCloseApps = webAppsNotAllowedToCloseValues.length > 0;

  if (!hasNotAllowedToCloseApps) {
    return updateTabState(global, {
      webApps: {
        ...currentTabState.webApps,
        activeWebApp: undefined,
        openedWebApps: {},
        openedOrderedKeys: [],
        sessionKeys: [],
      },
    }, tabId);
  }

  const currentActiveWebApp = currentTabState.webApps.activeWebApp;

  const newActiveWebApp = currentActiveWebApp?.shouldConfirmClosing
    ? currentActiveWebApp : webAppsNotAllowedToCloseValues[0];

  newActiveWebApp.isCloseModalOpen = true;

  const key = getWebAppKey(newActiveWebApp);

  if (key) webAppsNotAllowedToClose[key] = newActiveWebApp;
  const newOpenedKeys = currentTabState.webApps.openedOrderedKeys.filter((k) => k in webAppsNotAllowedToClose);

  return updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      activeWebApp: newActiveWebApp,
      isMoreAppsTabActive: false,
      openedWebApps: webAppsNotAllowedToClose,
      openedOrderedKeys: newOpenedKeys,
    },
  }, tabId);
}

export function hasOpenedWebApps<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): boolean {
  return Object.keys(selectTabState(global, tabId).webApps.openedWebApps).length > 0;
}

export function hasOpenedMoreThanOneWebApps<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): boolean {
  return Object.keys(selectTabState(global, tabId).webApps.openedWebApps).length > 1;
}

export function replaceWebAppModalState<T extends GlobalState>(
  global: T, modalState: WebAppModalStateType,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  return updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      modalState,
    },
  }, tabId);
}

export function replaceIsWebAppModalOpen<T extends GlobalState>(
  global: T, value: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  return updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      isModalOpen: value,
    },
  }, tabId);
}
