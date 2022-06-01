import * as idb from 'idb-keyval';

import type { ApiSessionData } from '../api/types';

import {
  DEBUG, GLOBAL_STATE_CACHE_KEY, LEGACY_SESSION_KEY, SESSION_USER_KEY,
} from '../config';
import * as cacheApi from './cacheApi';

const DC_IDS = [1, 2, 3, 4, 5];

export function hasStoredSession(withLegacy = false) {
  if (withLegacy && localStorage.getItem(LEGACY_SESSION_KEY)) {
    return true;
  }

  if (checkSessionLocked()) {
    return true;
  }

  const userAuthJson = localStorage.getItem(SESSION_USER_KEY);
  if (!userAuthJson) {
    return false;
  }

  try {
    const userAuth = JSON.parse(userAuthJson);
    return Boolean(userAuth && userAuth.id && userAuth.dcID);
  } catch (err) {
    // Do nothing.
    return false;
  }
}

export function storeSession(sessionData: ApiSessionData, currentUserId?: string) {
  const { mainDcId, keys, hashes } = sessionData;

  localStorage.setItem(SESSION_USER_KEY, JSON.stringify({ dcID: mainDcId, id: currentUserId }));
  localStorage.setItem('dc', String(mainDcId));
  Object.keys(keys).map(Number).forEach((dcId) => {
    localStorage.setItem(`dc${dcId}_auth_key`, JSON.stringify(keys[dcId]));
  });

  if (hashes) {
    Object.keys(hashes).map(Number).forEach((dcId) => {
      localStorage.setItem(`dc${dcId}_hash`, JSON.stringify(hashes[dcId]));
    });
  }
}

export function clearStoredSession() {
  [
    SESSION_USER_KEY,
    'dc',
    ...DC_IDS.map((dcId) => `dc${dcId}_auth_key`),
    ...DC_IDS.map((dcId) => `dc${dcId}_hash`),
    ...DC_IDS.map((dcId) => `dc${dcId}_server_salt`),
  ].forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function loadStoredSession(): ApiSessionData | undefined {
  if (!hasStoredSession()) {
    return undefined;
  }

  const userAuth = JSON.parse(localStorage.getItem(SESSION_USER_KEY)!);
  if (!userAuth) {
    return undefined;
  }
  const mainDcId = Number(userAuth.dcID);
  const keys: Record<number, string> = {};
  const hashes: Record<number, string> = {};

  DC_IDS.forEach((dcId) => {
    try {
      const key = localStorage.getItem(`dc${dcId}_auth_key`);
      if (key) {
        keys[dcId] = JSON.parse(key);
      }

      const hash = localStorage.getItem(`dc${dcId}_hash`);
      if (hash) {
        hashes[dcId] = JSON.parse(hash);
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
    hashes,
  };
}

export async function importLegacySession() {
  const sessionId = localStorage.getItem(LEGACY_SESSION_KEY);
  if (!sessionId) return;

  const sessionJson = await idb.get(`GramJs:${sessionId}`);
  try {
    const sessionData = JSON.parse(sessionJson) as ApiSessionData;
    storeSession(sessionData);
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load legacy session', err);
    }
    // Do nothing.
  }
}

// Remove previously created IndexedDB and cache API sessions
export async function clearLegacySessions() {
  localStorage.removeItem(LEGACY_SESSION_KEY);

  const idbKeys = await idb.keys();

  await Promise.all<Promise<any>>([
    cacheApi.clear('GramJs'),
    ...idbKeys
      .filter((k) => typeof k === 'string' && k.startsWith('GramJs:GramJs-session-'))
      .map((k) => idb.del(k)),
  ]);
}

export function importTestSession() {
  const sessionJson = process.env.TEST_SESSION!;
  try {
    const sessionData = JSON.parse(sessionJson) as ApiSessionData & { userId: string };
    storeSession(sessionData, sessionData.userId);
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load test session', err);
    }
    // Do nothing.
  }
}

function checkSessionLocked() {
  const stateFromCache = JSON.parse(localStorage.getItem(GLOBAL_STATE_CACHE_KEY) || '{}');

  return Boolean(stateFromCache?.passcode?.isScreenLocked);
}
