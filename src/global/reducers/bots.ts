import type { InlineBotSettings } from '../../types';
import type { WebApp, WebAppModalStateType } from '../../types/webapp';
import type {
  GlobalState, TabArgs,
} from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { getWebAppKey } from '../helpers/bots';
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

  global = updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
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

  global = updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      isMoreAppsTabActive: false,
      activeWebAppKey: webAppKey,
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
      ...makeActive && { activeWebAppKey: key },
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
  const activeWebAppKey = currentTabState.webApps.activeWebAppKey;

  if (!activeWebAppKey) return global;

  return removeWebAppFromOpenList(global, activeWebAppKey, false, tabId);
}

export function removeWebAppFromOpenList<T extends GlobalState>(
  global: T, key: string, skipClosingConfirmation?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentTabState = selectTabState(global, tabId);
  const { openedWebApps, openedOrderedKeys, activeWebAppKey } = currentTabState.webApps;
  const webApp = openedWebApps[key];
  if (!webApp) return global;

  if (!skipClosingConfirmation && webApp.shouldConfirmClosing) {
    return updateWebApp(global, key, { isCloseModalOpen: true }, tabId);
  }

  const updatedOpenedWebApps = { ...openedWebApps };
  const removingWebAppKey = getWebAppKey(webApp);

  let newOpenedKeys = openedOrderedKeys;

  if (removingWebAppKey) {
    delete updatedOpenedWebApps[removingWebAppKey];
    newOpenedKeys = openedOrderedKeys.filter((k) => k !== removingWebAppKey);
  }

  const isRemovedAppActive = activeWebAppKey === getWebAppKey(webApp);

  const openedWebAppsKeys = Object.keys(updatedOpenedWebApps);
  const openedWebAppsCount = openedWebAppsKeys.length;

  global = updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      ...isRemovedAppActive && {
        activeWebAppKey: openedWebAppsCount
          ? openedWebAppsKeys[openedWebAppsCount - 1] : undefined,
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
      ([, webApp]) => webApp.shouldConfirmClosing,
    ),
  );

  const webAppsNotAllowedToCloseValues = Object.values(webAppsNotAllowedToClose);
  const hasNotAllowedToCloseApps = webAppsNotAllowedToCloseValues.length > 0;

  if (!hasNotAllowedToCloseApps) {
    return updateTabState(global, {
      webApps: {
        ...currentTabState.webApps,
        activeWebAppKey: undefined,
        openedWebApps: {},
        openedOrderedKeys: [],
        sessionKeys: [],
      },
    }, tabId);
  }

  const currentActiveWebApp = selectActiveWebApp(global, tabId);

  const newActiveWebApp = currentActiveWebApp?.shouldConfirmClosing
    ? currentActiveWebApp : webAppsNotAllowedToCloseValues[0];

  const newActiveWebAppKey = getWebAppKey(newActiveWebApp);

  if (newActiveWebAppKey) {
    webAppsNotAllowedToClose[newActiveWebAppKey] = {
      ...newActiveWebApp,
      isCloseModalOpen: true,
    };
  }
  const newOpenedKeys = currentTabState.webApps.openedOrderedKeys.filter((k) => webAppsNotAllowedToClose[k]);

  return updateTabState(global, {
    webApps: {
      ...currentTabState.webApps,
      activeWebAppKey: newActiveWebAppKey,
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
