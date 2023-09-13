import type { GlobalState, TabState } from '../types';

import { INITIAL_GLOBAL_STATE, INITIAL_TAB_STATE } from '../initialState';

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
  const {
    theme,
    shouldUseSystemTheme,
    animationLevel,
    language,
  } = global.settings.byKey;

  return {
    ...INITIAL_GLOBAL_STATE,
    passcode: global.passcode,
    settings: {
      ...INITIAL_GLOBAL_STATE.settings,
      byKey: {
        ...INITIAL_GLOBAL_STATE.settings.byKey,
        theme,
        shouldUseSystemTheme,
        animationLevel,
        language,
      },
    },
    ...(withTabState && {
      byTabId: Object.values(global.byTabId).reduce((acc, { id: tabId, isMasterTab }) => {
        acc[tabId] = { ...INITIAL_TAB_STATE, isMasterTab, id: tabId };
        return acc;
      }, {} as Record<number, TabState>),
    }),
  } as T;
}
