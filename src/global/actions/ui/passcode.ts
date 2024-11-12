import type { ActionReturnType } from '../../types';
import { SettingsScreens } from '../../../types';

import { getCurrentTabId, signalPasscodeHash } from '../../../util/establishMultitabRole';
import { cloneDeep } from '../../../util/iteratees';
import {
  clearEncryptedSession, encryptSession, forgetPasscode, setupPasscode,
} from '../../../util/passcode';
import { onBeforeUnload } from '../../../util/schedulers';
import { clearStoredSession, loadStoredSession, storeSession } from '../../../util/sessions';
import { forceUpdateCache, migrateCache, serializeGlobal } from '../../cache';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { INITIAL_GLOBAL_STATE } from '../../initialState';
import { clearPasscodeSettings, updatePasscodeSettings } from '../../reducers';

let noLockOnUnload = false;
onBeforeUnload(() => {
  // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
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

  try {
    await encryptSession(sessionJson, globalJson);

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
    actions.requestNextSettingsScreen({ screen: SettingsScreens.PasscodeDisabled, tabId });
  }
});

addActionHandler('clearPasscode', (global): ActionReturnType => {
  void clearEncryptedSession();

  return clearPasscodeSettings(global);
});

addActionHandler('unlockScreen', (global, actions, payload): ActionReturnType => {
  const beforeTabStates = Object.values(global.byTabId);
  const { sessionJson, globalJson } = payload;
  const session = JSON.parse(sessionJson);
  storeSession(session, session.userId);

  const previousGlobal = global;
  global = JSON.parse(globalJson);
  global.byTabId = previousGlobal.byTabId;
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
