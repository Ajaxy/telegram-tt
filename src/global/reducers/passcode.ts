import type { GlobalState, SharedState, TabState } from '../types';

import { INITIAL_GLOBAL_STATE, INITIAL_SHARED_STATE, INITIAL_TAB_STATE } from '../initialState';

export function updatePasscodeSettings<T extends GlobalState>(
  global: T,
  update: GlobalState['passcode'],
): T {
  return {
    ...global,
    passcode: {
      ...global.passcode,
      ...update,
    },
  };
}

export function clearPasscodeSettings<T extends GlobalState>(global: T): T {
  return {
    ...global,
    passcode: {},
  };
}

export function clearGlobalForLockScreen<T extends GlobalState>(global: T, withTabState = true): T {
  return {
    ...INITIAL_GLOBAL_STATE,
    passcode: global.passcode,
    settings: INITIAL_GLOBAL_STATE.settings,
    sharedState: clearSharedStateForLockScreen(global.sharedState),
    ...(withTabState && {
      byTabId: Object.values(global.byTabId).reduce((acc, { id: tabId, isMasterTab }) => {
        acc[tabId] = { ...INITIAL_TAB_STATE, isMasterTab, id: tabId };
        return acc;
      }, {} as Record<number, TabState>),
    }),
  } as T;
}

export function clearSharedStateForLockScreen(sharedState: SharedState): SharedState {
  const {
    theme,
    shouldUseSystemTheme,
    animationLevel,
    language,
  } = sharedState.settings;

  return {
    ...INITIAL_SHARED_STATE,
    settings: {
      ...INITIAL_SHARED_STATE.settings,
      theme,
      shouldUseSystemTheme,
      animationLevel,
      language,
    },
  };
}
