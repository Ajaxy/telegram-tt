import { addActionHandler, setGlobal, getGlobal } from '../../index';

import { clearPasscodeSettings, updatePasscodeSettings } from '../../reducers';
import { clearStoredSession, loadStoredSession, storeSession } from '../../../util/sessions';
import { clearEncryptedSession, encryptSession, setupPasscode } from '../../../util/passcode';
import { forceUpdateCache, migrateCache, serializeGlobal } from '../../cache';
import { onBeforeUnload } from '../../../util/schedulers';
import { cloneDeep } from '../../../util/iteratees';
import { INITIAL_STATE } from '../../initialState';

let noLockOnUnload = false;
onBeforeUnload(() => {
  if (getGlobal().passcode.hasPasscode && !noLockOnUnload) {
    clearStoredSession();
  }
});

addActionHandler('setPasscode', async (global, actions, { passcode }) => {
  setGlobal(updatePasscodeSettings(global, {
    isLoading: true,
  }));
  await setupPasscode(passcode);

  const sessionJson = JSON.stringify({ ...loadStoredSession(), userId: global.currentUserId });
  const globalJson = serializeGlobal(updatePasscodeSettings(getGlobal(), {
    hasPasscode: true,
    error: undefined,
    isLoading: false,
  }));

  await encryptSession(sessionJson, globalJson);

  setGlobal(updatePasscodeSettings(getGlobal(), {
    hasPasscode: true,
    error: undefined,
    isLoading: false,
  }));

  forceUpdateCache(true);
});

addActionHandler('clearPasscode', (global) => {
  void clearEncryptedSession();

  return clearPasscodeSettings(global);
});

addActionHandler('unlockScreen', (global, actions, { sessionJson, globalJson }) => {
  const session = JSON.parse(sessionJson);
  storeSession(session, session.userId);

  global = JSON.parse(globalJson);
  migrateCache(global, cloneDeep(INITIAL_STATE));

  setGlobal(updatePasscodeSettings(
    global,
    {
      isScreenLocked: false,
      error: undefined,
      invalidAttemptsCount: 0,
    },
  ));

  actions.initApi();
});

addActionHandler('logInvalidUnlockAttempt', (global) => {
  return updatePasscodeSettings(global, {
    invalidAttemptsCount: (global.passcode?.invalidAttemptsCount ?? 0) + 1,
  });
});

addActionHandler('resetInvalidUnlockAttempts', (global) => {
  return updatePasscodeSettings(global, {
    invalidAttemptsCount: 0,
  });
});

addActionHandler('setPasscodeError', (global, actions, payload) => {
  const { error } = payload;

  return updatePasscodeSettings(global, { error });
});

addActionHandler('clearPasscodeError', (global) => {
  return updatePasscodeSettings(global, { error: undefined });
});

addActionHandler('skipLockOnUnload', () => {
  noLockOnUnload = true;
});
