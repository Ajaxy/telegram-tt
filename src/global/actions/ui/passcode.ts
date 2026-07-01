import type { ActionReturnType } from '../../types';
import { SettingsScreens } from '../../../types';

import { IS_SCREEN_LOCKED_CACHE_KEY } from '../../../config';
import { getCurrentTabId, signalPasscodeHash } from '../../../util/establishMultitabRole';
import { cloneDeep } from '../../../util/iteratees';
import {
  clearEncryptedSession, encryptSession, forgetPasscode, setupPasscode,
} from '../../../util/passcode';
import { onBeforeUnload } from '../../../util/schedulers';
import { clearStoredSession, loadStoredSession, storeSession } from '../../../util/sessions';
import {
  forceUpdateCache, migrateCache, serializeGlobal, serializeShared,
} from '../../cache';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { INITIAL_GLOBAL_STATE } from '../../initialState';
import { clearPasscodeSettings, updatePasscodeSettings } from '../../reducers';

let noLockOnUnload = false;
onBeforeUnload(() => {
  const global = getGlobal();
  if (!global.isInited) return;
  if (global.passcode.hasPasscode && !noLockOnUnload && Object.keys(global.byTabId).length === 1) {
    clearStoredSession();
  }
});

addActionHandler('setPasscode', async (global, actions, payload): Promise<void> => {
  const { passcode, tabId = getCurrentTabId() } = payload;
  global = updatePasscodeSettings(global, {
    isLoading: true,
  });
  setGlobal(global);
  await setupPasscode(passcode);

  const sessionJson = JSON.stringify({ ...loadStoredSession(), userId: global.currentUserId });
  global = getGlobal();
  const globalJson = serializeGlobal(updatePasscodeSettings(global, {
    hasPasscode: true,
    error: undefined,
    isLoading: false,
  }));
  const sharedStateJson = serializeShared(global.sharedState);

  try {
    await encryptSession(sessionJson, globalJson, sharedStateJson);

    signalPasscodeHash();
    global = getGlobal();
    global = updatePasscodeSettings(global, {
      hasPasscode: true,
      error: undefined,
      isLoading: false,
    });
    setGlobal(global);

    forceUpdateCache(true);
  } catch (err: any) {
    forgetPasscode();

    global = getGlobal();
    global = updatePasscodeSettings(global, {
      isLoading: false,
    });
    setGlobal(global);

    actions.showNotification({
      message: 'Failed to set passcode',
      tabId,
    });
    actions.openSettingsScreen({ screen: SettingsScreens.PasscodeDisabled, tabId });
  }
});

addActionHandler('clearPasscode', (global): ActionReturnType => {
  void clearEncryptedSession();

  localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
  return clearPasscodeSettings(global);
});

addActionHandler('unlockScreen', (global, actions, payload): ActionReturnType => {
  const beforeTabStates = Object.values(global.byTabId);
  const { sessionJson, globalJson, sharedStateJson } = payload;
  const session = JSON.parse(sessionJson);
  storeSession(session);

  const previousGlobal = global;
  global = JSON.parse(globalJson);
  global.byTabId = previousGlobal.byTabId;
  // `serializeGlobal` reseeds `sharedState` from `INITIAL_GLOBAL_STATE`, so restore it separately to avoid
  // resetting theme and other shared settings. Fall back to the live state for sessions locked before it was persisted
  global.sharedState = sharedStateJson ? JSON.parse(sharedStateJson) : previousGlobal.sharedState;
  migrateCache(global, cloneDeep(INITIAL_GLOBAL_STATE));

  global = updatePasscodeSettings(
    global,
    {
      isScreenLocked: false,
      error: undefined,
      invalidAttemptsCount: 0,
    },
  );
  setGlobal(global);

  signalPasscodeHash();

  beforeTabStates.forEach(({ id: tabId, isMasterTab }) => actions.init({ tabId, isMasterTab }));
  beforeTabStates.forEach(({ id: tabId }) => actions.setIsUiReady({ uiReadyState: 2, tabId }));
  actions.initApi();
});

const MAX_INVALID_ATTEMPTS = 5;
const TIMEOUT_RESET_INVALID_ATTEMPTS_MS = 1000 * 15;// 180000; // 3 minutes

addActionHandler('logInvalidUnlockAttempt', (global): ActionReturnType => {
  const invalidAttemptsCount = (global.passcode?.invalidAttemptsCount ?? 0) + 1;

  return updatePasscodeSettings(global, {
    invalidAttemptsCount,
    timeoutUntil: (invalidAttemptsCount >= MAX_INVALID_ATTEMPTS
      ? Date.now() + TIMEOUT_RESET_INVALID_ATTEMPTS_MS : undefined),
  });
});

addActionHandler('resetInvalidUnlockAttempts', (global): ActionReturnType => {
  return updatePasscodeSettings(global, {
    invalidAttemptsCount: 0,
    timeoutUntil: undefined,
  });
});

addActionHandler('setPasscodeError', (global, actions, payload): ActionReturnType => {
  const { error } = payload;

  return updatePasscodeSettings(global, { error });
});

addActionHandler('clearPasscodeError', (global): ActionReturnType => {
  return updatePasscodeSettings(global, { error: undefined });
});

addActionHandler('skipLockOnUnload', (): ActionReturnType => {
  noLockOnUnload = true;
});
