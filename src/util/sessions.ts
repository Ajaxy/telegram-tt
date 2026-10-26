import type { ApiSessionData } from '../api/types';
import type { DcId, SharedSessionData } from '../types';

import {
  DC_IDS,
  DEBUG,
  SESSION_ACCOUNT_PREFIX,
  SESSION_LEGACY_USER_KEY,
  TEST_SESSION,
} from '../config';
import {
  isEncryptedSessionStoreEnabled,
  isSessionStoreLocked,
  readSessionValue,
  removeSessionValue,
  writeSessionValue,
} from './passcode/sessionStore';
import {
  ACCOUNT_SLOT, getAccountSlots, loadSlotSession, storeAccountData, updateSessionStorage,
} from './multiaccount';
import { lockPasscodeSessionStore } from './passcode';

export function hasStoredSession() {
  if (checkSessionLocked()) return true;

  const slotData = loadSlotSession(ACCOUNT_SLOT);
  if (slotData) return Boolean(slotData.dcId);

  if (!ACCOUNT_SLOT) {
    const legacyAuthJson = readSessionValue(SESSION_LEGACY_USER_KEY);
    if (legacyAuthJson) {
      try {
        const userAuth = JSON.parse(legacyAuthJson);
        return Boolean(userAuth && userAuth.id && userAuth.dcID);
      } catch (err) {
        // Do nothing.
        return false;
      }
    }
  }

  return false;
}

export function storeSession(sessionData: ApiSessionData) {
  return updateSessionStorage(() => {
    const {
      mainDcId, keys, authKeyCreatedAt, tempAuthKey, isTest,
    } = sessionData;

    const currentSlotData = loadSlotSession(ACCOUNT_SLOT);
    const newSlotData: SharedSessionData = {
      ...currentSlotData,
      dcId: mainDcId,
      authKeyCreatedAt,
      tempAuthKey,
      isTest,
    };

    Object.keys(keys).map(Number).forEach((dcId) => {
      newSlotData[`dc${dcId as DcId}_auth_key`] = keys[dcId];
    });

    if (!ACCOUNT_SLOT) {
      storeLegacySession(sessionData, currentSlotData?.userId);
    }

    writeSessionValue(`${SESSION_ACCOUNT_PREFIX}${ACCOUNT_SLOT || 1}`, JSON.stringify(newSlotData));
  });
}

function storeLegacySession(sessionData: ApiSessionData, currentUserId?: string) {
  const {
    mainDcId, keys, isTest,
  } = sessionData;

  writeSessionValue(SESSION_LEGACY_USER_KEY, JSON.stringify({
    dcID: mainDcId,
    id: currentUserId,
    test: isTest,
  }));
  writeSessionValue('dc', String(mainDcId));
  Object.keys(keys).map(Number).forEach((dcId) => {
    writeSessionValue(`dc${dcId}_auth_key`, JSON.stringify(keys[dcId]));
  });
}

export function clearStoredSession(slot?: number) {
  return updateSessionStorage(() => {
    if (!slot) {
      clearStoredLegacySession();
    }

    removeSessionValue(`${SESSION_ACCOUNT_PREFIX}${slot || 1}`);
  });
}

// Intentionally does not refresh the sessions vault: used when locking the screen,
// when the encrypted copy must keep the last good snapshot
export function clearAllStoredSessions() {
  if (isEncryptedSessionStoreEnabled()) {
    lockPasscodeSessionStore();
    return;
  }

  clearStoredLegacySession();

  getAccountSlots().forEach((slot) => removeSessionValue(`${SESSION_ACCOUNT_PREFIX}${slot}`));
}

function clearStoredLegacySession() {
  [
    SESSION_LEGACY_USER_KEY,
    'dc',
    ...DC_IDS.map((dcId) => `dc${dcId}_auth_key`),
    ...DC_IDS.map((dcId) => `dc${dcId}_hash`),
    ...DC_IDS.map((dcId) => `dc${dcId}_server_salt`),
  ].forEach((key) => {
    removeSessionValue(key);
  });
}

export function loadStoredSession(): ApiSessionData | undefined {
  if (!hasStoredSession()) {
    return undefined;
  }

  const slotData = loadSlotSession(ACCOUNT_SLOT);

  if (!slotData) {
    if (ACCOUNT_SLOT) return undefined;
    return loadStoredLegacySession();
  }

  const sessionData: ApiSessionData = {
    mainDcId: slotData.dcId,
    keys: DC_IDS.reduce((acc, dcId) => {
      const key = slotData[`dc${dcId}_auth_key` as const];
      if (key) {
        acc[dcId] = key;
      }
      return acc;
    }, {} as Record<number, string>),
    authKeyCreatedAt: slotData.authKeyCreatedAt,
    tempAuthKey: slotData.tempAuthKey,
    isTest: slotData.isTest || undefined,
  };

  return sessionData;
}

function loadStoredLegacySession(): ApiSessionData | undefined {
  if (!hasStoredSession()) {
    return undefined;
  }

  const userAuth = JSON.parse(readSessionValue(SESSION_LEGACY_USER_KEY) || 'null');
  if (!userAuth) {
    return undefined;
  }
  const mainDcId = Number(userAuth.dcID);
  const isTest = userAuth.test;
  const keys: Record<number, string> = {};

  DC_IDS.forEach((dcId) => {
    try {
      const key = readSessionValue(`dc${dcId}_auth_key`);
      if (key) {
        keys[dcId] = JSON.parse(key);
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn('Failed to load stored session', err);
      }
      // Do nothing.
    }
  });

  if (!Object.keys(keys).length) return undefined;

  return {
    mainDcId,
    keys,
    isTest,
  };
}

export function updateSessionUserId(currentUserId: string) {
  return storeAccountData(ACCOUNT_SLOT, { userId: currentUserId });
}

export function importTestSession() {
  const sessionJson = TEST_SESSION!;
  try {
    const sessionData = JSON.parse(sessionJson) as ApiSessionData & { userId: string };
    storeLegacySession(sessionData, sessionData.userId);
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load test session', err);
    }
  }
}

export function checkSessionLocked() {
  return isSessionStoreLocked();
}
