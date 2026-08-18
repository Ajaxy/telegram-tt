import type { GlobalState } from '../types';

type TabCallback = (tabId: number) => void;

export function runForAllTabs(global: GlobalState, callback: TabCallback) {
  Object.values(global.byTabId).forEach(({ id: tabId }) => callback(tabId));
}

export function runForFocusedTabs(global: GlobalState, callback: TabCallback) {
  Object.values(global.byTabId).forEach(({ id: tabId, isBlurred }) => {
    if (!isBlurred) callback(tabId);
  });
}
