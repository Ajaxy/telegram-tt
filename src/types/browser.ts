import type { WebApp } from './webapp';

export type BrowserModalStateType = 'fullScreen' | 'maximized' | 'minimized';

export type BrowserWebAppTab = {
  type: 'webApp';
  webApp: WebApp;
};

export type BrowserInstantViewTab = {
  type: 'instantView';
  webPageId: string;
};

export type BrowserTab = BrowserWebAppTab | BrowserInstantViewTab;

export type BrowserState = {
  activeTabKey?: string;
  openedOrderedKeys: string[];
  sessionKeys: string[];
  openedTabs: Record<string, BrowserTab>;
  modalState: BrowserModalStateType;
  isModalOpen: boolean;
  isMoreAppsTabActive: boolean;
};
