import type { GlobalState } from '../global/types';

import { DEBUG, IS_MOCKED_CLIENT, IS_SCREEN_LOCKED_CACHE_KEY } from '../config';
import {
  loadCache, loadCachedSharedState, migrateCache, migrateSharedCache, removeAllGlobalCaches, setupCaching,
} from '../global/cache';
import {
  getGlobal, setGlobal,
} from '../global/index';
import { INITIAL_GLOBAL_STATE } from '../global/initialState';
import { clearGlobalForLockScreen, clearPasscodeSettings, updatePasscodeSettings } from '../global/reducers';
import { broadcastPasscodeState, requestDekFromOtherTabs } from './passcode/channel';
import { requestPasscodeNavigationDek } from './passcode/navigation';
import { resetSessionStore } from './passcode/sessionStore';
import { purgePasscodeCaches } from './cacheApi';
import { cloneDeep } from './iteratees';
import { ACCOUNT_SLOT } from './multiaccount';
import { unsubscribeLocally } from './notifications';
import {
  abortPasscodeDisable,
  clearLegacyEncryptedSessionIfAllowed,
  forgetDek,
  getDek,
  getDekGeneration,
  hasLegacyEncryptedSession,
  loadPasscodeMeta,
  lockPasscodeSessionStore,
  markPasscodeLocked,
  readGlobalsVaultForSlot,
  requestPasscodeStateLock,
  restoreMissingSessionsFromVault,
  setDek,
} from './passcode';
import { clearAllStoredSessions } from './sessions';
import { clearLockScreenWallpaperBlobs, clearPlaintextWallpaperBlobs } from './wallpaperStorage';

export async function initGlobal(force: boolean = false, prevGlobal?: GlobalState) {
  prevGlobal = prevGlobal || getGlobal();
  if (!force && 'byTabId' in prevGlobal) {
    // Global was received from a master tab of the same slot
    await ensureDekForUnlockedSession(prevGlobal);
    return;
  }

  const initial = cloneDeep(INITIAL_GLOBAL_STATE);
  const cache = await loadCache(initial);
  let global = cache || initial;
  if (IS_MOCKED_CLIENT) global.auth.state = 'authorizationStateReady';

  global = await applyPasscodeStateOnBoot(global);

  if (force) {
    global.byTabId = prevGlobal.byTabId;
  }

  if (!cache) { // Try loading shared state separately
    const storedSharedState = await loadCachedSharedState();
    if (storedSharedState) {
      const sharedState = migrateSharedCache(storedSharedState, undefined, global.sharedState);
      global.sharedState = {
        ...global.sharedState,
        ...sharedState,
        settings: {
          ...global.sharedState.settings,
          ...sharedState.settings,
        },
      };
    }
  }

  if (global.passcode.hasPasscode && !global.sharedState.settings.shouldKeepLockScreenBackground) {
    await clearLockScreenWallpaperBlobs().catch(() => undefined);
  }

  const currentGlobal = getGlobal();
  if (!force && 'byTabId' in currentGlobal) {
    await ensureDekForUnlockedSession(currentGlobal);
    if (cache) setupCaching();
    return;
  }

  setGlobal(global);
  if (cache) setupCaching();
}

async function ensureDekForUnlockedSession(global: GlobalState) {
  const shouldReinit = await requestPasscodeStateLock(async () => {
    const meta = await loadPasscodeMeta();
    if (!meta) return false;

    lockPasscodeSessionStore();
    if (meta.isDisabling || meta.isLocked || global.passcode.isScreenLocked) return true;

    const dek = await resolveDek(meta.generation);
    if (!dek) {
      await purgePasscodePlaintext();
      global = buildLockedGlobal(getGlobal(), meta);
      setGlobal(global);
      return false;
    }

    setDek(dek, meta.generation);
    try {
      await restoreMissingSessionsFromVault();
      broadcastPasscodeState(dek, meta.generation);
      global = updatePasscodeSettings(getGlobal(), {
        hasPasscode: true,
        isScreenLocked: false,
        hasPasskey: Boolean(meta.passkey),
        autolockDuration: meta.autolockDuration,
      });
      setGlobal(global);
    } catch (err) {
      logVaultRestoreError(err);
      forgetDek(meta.generation);
      await purgePasscodePlaintext();
      global = buildLockedGlobal(getGlobal(), meta, true);
      setGlobal(global);
    }
    return false;
  });

  if (shouldReinit) await initGlobal(true, global);
}

async function applyPasscodeStateOnBoot<T extends GlobalState>(global: T): Promise<T> {
  return requestPasscodeStateLock(() => applyPasscodeStateOnBootLocked(global));
}

async function applyPasscodeStateOnBootLocked<T extends GlobalState>(global: T): Promise<T> {
  let meta = await loadPasscodeMeta();
  if (meta?.isDisabling) {
    if (await abortPasscodeDisable(meta.generation)) {
      lockPasscodeSessionStore();
      await purgePasscodePlaintext();
      localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'false');
      broadcastPasscodeState(getDek(), meta.generation);
    }
    meta = await loadPasscodeMeta();
  }

  const hasLegacy = !meta && Boolean(await hasLegacyEncryptedSession());
  if (meta) lockPasscodeSessionStore();
  if (!meta && !hasLegacy) {
    forgetDek();
    resetSessionStore();
    localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
    return global.passcode.hasPasscode || global.passcode.isScreenLocked
      ? clearPasscodeSettings(global) : global;
  }

  let isLocked = true;
  let isDataCorrupted: boolean | undefined;
  if (meta && !meta.isLocked) {
    const dek = await resolveDek(meta.generation);
    if (dek) {
      setDek(dek, meta.generation);
      try {
        await restoreMissingSessionsFromVault();
        const globalJson = await readGlobalsVaultForSlot(ACCOUNT_SLOT);
        if (globalJson) await clearLegacyEncryptedSessionIfAllowed().catch(() => undefined);
        if (localStorage.getItem(IS_SCREEN_LOCKED_CACHE_KEY) === 'false') {
          global = restoreGlobal(global, globalJson);
          isLocked = false;
          broadcastPasscodeState(dek, meta.generation);
        } else {
          forgetDek(meta.generation);
        }
      } catch (err) {
        logVaultRestoreError(err);
        forgetDek(meta.generation);
        isDataCorrupted = true;
      }
    }
  }

  if (isLocked) {
    let didMarkLocked = false;
    if (meta && !meta.isLocked) {
      didMarkLocked = await markPasscodeLocked(meta.generation).catch(() => undefined) !== undefined;
      if (didMarkLocked) meta = await loadPasscodeMeta();
    }
    localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'true');
    await Promise.all([
      purgePasscodePlaintext(hasLegacy),
      unsubscribeLocally().catch(() => undefined),
    ]);
    if (didMarkLocked && meta) broadcastPasscodeState(undefined, meta.generation);
    global = clearGlobalForLockScreen(global);
  }

  return updatePasscodeSettings(global, {
    hasPasscode: true,
    isScreenLocked: isLocked,
    hasPasskey: Boolean(meta?.passkey),
    autolockDuration: meta?.autolockDuration,
    invalidAttemptsCount: meta?.invalidAttemptsCount,
    timeoutUntil: meta?.timeoutUntil,
    errorKey: undefined,
    isLoading: false,
    isDataCorrupted,
  });
}

async function purgePasscodePlaintext(shouldPreserveLegacyAccounts = false) {
  if (!shouldPreserveLegacyAccounts) {
    clearAllStoredSessions();
    await removeAllGlobalCaches().catch(logPlaintextPurgeError);
  }

  await Promise.all([
    clearPlaintextWallpaperBlobs().catch(logPlaintextPurgeError),
    purgePasscodeCaches().catch(logPlaintextPurgeError),
  ]);
}

function buildLockedGlobal<T extends GlobalState>(
  global: T,
  meta: NonNullable<Awaited<ReturnType<typeof loadPasscodeMeta>>>,
  isDataCorrupted?: boolean,
) {
  return updatePasscodeSettings(clearGlobalForLockScreen(global), {
    hasPasscode: true,
    isScreenLocked: true,
    hasPasskey: Boolean(meta.passkey),
    autolockDuration: meta.autolockDuration,
    isDataCorrupted,
  });
}

function restoreGlobal<T extends GlobalState>(global: T, globalJson?: string): T {
  const restoredGlobal = globalJson ? JSON.parse(globalJson) as T : cloneDeep(INITIAL_GLOBAL_STATE) as T;
  restoredGlobal.byTabId = global.byTabId;
  restoredGlobal.sharedState = global.sharedState;
  if (globalJson) migrateCache(restoredGlobal, cloneDeep(INITIAL_GLOBAL_STATE));
  return restoredGlobal;
}

function logVaultRestoreError(err: unknown) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.error('Failed to restore sessions from vault', err);
  }
}

function logPlaintextPurgeError(err: unknown) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.error('Failed to purge passcode plaintext', err);
  }
}

async function resolveDek(generation: string) {
  if (getDekGeneration() === generation) return getDek();

  const otherTabDekPromise = requestDekFromOtherTabs(generation);
  return await requestPasscodeNavigationDek(generation) || await otherTabDekPromise;
}
