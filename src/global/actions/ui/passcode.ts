import { addActionHandler, setGlobal, getGlobal } from '../../index';

import { clearPasscodeSettings, updatePasscodeSettings } from '../../reducers';
import { clearStoredSession, loadStoredSession, storeSession } from '../../../util/sessions';
import {
  clearEncryptedSession, decryptSession, encryptSession, setupPasscode,
} from '../../../util/passcode';
import { forceUpdateCache, migrateCache, serializeGlobal } from '../../cache';
import { onBeforeUnload } from '../../../util/schedulers';
import { cloneDeep } from '../../../util/iteratees';
import { INITIAL_GLOBAL_STATE } from '../../initialState';
import type { ActionReturnType } from '../../types';
import { signalPasscodeHash } from '../../../util/establishMultitabRole';

let noLockOnUnload = false;
onBeforeUnload(() => {
  // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
  if (getGlobal().passcode.hasPasscode && !noLockOnUnload && Object.keys(getGlobal().byTabId).length === 1) {
    clearStoredSession();
  }
});

addActionHandler('setPasscode', async (global, actions, payload): Promise<void> => {
  const { passcode } = payload;
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

addActionHandler('decryptSession', (global, actions, payload): ActionReturnType => {
  const { passcode } = payload;
  decryptSession(passcode).then(actions.unlockScreen, () => {
    actions.logInvalidUnlockAttempt();
  });
});

addActionHandler('logInvalidUnlockAttempt', (global): ActionReturnType => {
  return updatePasscodeSettings(global, {
    invalidAttemptsCount: (global.passcode?.invalidAttemptsCount ?? 0) + 1,
  });
});

addActionHandler('resetInvalidUnlockAttempts', (global): ActionReturnType => {
  return updatePasscodeSettings(global, {
    invalidAttemptsCount: 0,
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
