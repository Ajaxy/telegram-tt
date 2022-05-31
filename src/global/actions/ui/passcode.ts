import { addActionHandler, setGlobal, getGlobal } from '../../index';

import { clearPasscodeSettings, updatePasscodeSettings } from '../../reducers';
import { loadStoredSession, storeSession } from '../../../util/sessions';
import { clearEncryptedSession, encryptSession, setupPasscode } from '../../../util/passcode';
import { serializeGlobal } from '../../cache';

addActionHandler('setPasscode', async (global, actions, { passcode }) => {
  setGlobal(updatePasscodeSettings(global, {
    isLoading: true,
  }));
  await setupPasscode(passcode);

  const sessionJson = JSON.stringify({ ...loadStoredSession(), userId: global.currentUserId });
  const globalJson = serializeGlobal();

  await encryptSession(sessionJson, globalJson);

  setGlobal(updatePasscodeSettings(getGlobal(), {
    hasPasscode: true,
    error: undefined,
    isLoading: false,
  }));
});

addActionHandler('clearPasscode', (global) => {
  void clearEncryptedSession();

  return clearPasscodeSettings(global);
});

addActionHandler('unlockScreen', (global, actions, { sessionJson, globalJson }) => {
  const session = JSON.parse(sessionJson);
  storeSession(session, session.userId);

  global = JSON.parse(globalJson);
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
