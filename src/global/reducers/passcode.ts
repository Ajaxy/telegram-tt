import type { GlobalState } from '../types';
import { INITIAL_STATE } from '../initialState';

export function updatePasscodeSettings(
  global: GlobalState,
  update: GlobalState['passcode'],
): GlobalState {
  return {
    ...global,
    passcode: {
      ...global.passcode,
      ...update,
    },
  };
}

export function clearPasscodeSettings(global: GlobalState): GlobalState {
  return {
    ...global,
    passcode: {},
  };
}

export function clearGlobalForLockScreen(global: GlobalState): GlobalState {
  const {
    theme,
    shouldUseSystemTheme,
    animationLevel,
    language,
  } = global.settings.byKey;

  return {
    ...INITIAL_STATE,
    passcode: global.passcode,
    settings: {
      ...INITIAL_STATE.settings,
      byKey: {
        ...INITIAL_STATE.settings.byKey,
        theme,
        shouldUseSystemTheme,
        animationLevel,
        language,
      },
    },
  };
}
