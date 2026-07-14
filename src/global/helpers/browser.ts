import type { BrowserState, BrowserTab } from '../../types/browser';
import type { WebApp } from '../../types/webapp';
import type { TabState } from '../types';

import { getWebAppKey } from './bots';

const INSTANT_VIEW_TAB_KEY_PREFIX = 'instantView:';

export const INITIAL_BROWSER_STATE: BrowserState = {
  openedTabs: {},
  openedOrderedKeys: [],
  sessionKeys: [],
  modalState: 'maximized',
  isModalOpen: false,
  isMoreAppsTabActive: false,
};

export function getBrowserTabKey(tab: BrowserTab) {
  if (tab.type === 'instantView') {
    return getInstantViewBrowserTabKey(tab.webPageId);
  }

  return getWebAppKey(tab.webApp);
}

export function getInstantViewBrowserTabKey(webPageId: string) {
  return `${INSTANT_VIEW_TAB_KEY_PREFIX}${webPageId}`;
}

export function getBrowserWebAppTabKey(webApp: Partial<WebApp>) {
  return getWebAppKey(webApp);
}

export function selectTabBrowserState(tabState: TabState): BrowserState {
  return tabState.browser || INITIAL_BROWSER_STATE;
}
