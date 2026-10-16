import type { RegularLangFnParameters } from '../../../util/localization';
import type { ActionReturnType, GlobalState } from '../../types';
import { SettingsScreens } from '../../../types';

import {
  IS_SCREEN_LOCKED_CACHE_KEY, LOCK_SCREEN_ANIMATION_DURATION_MS,
} from '../../../config';
import { updateAppBadge } from '../../../util/appBadge';
import { purgePasscodeCaches } from '../../../util/cacheApi';
import { getCurrentTabId, reestablishMasterToSelf } from '../../../util/establishMultitabRole';
import { updateFolderManager } from '../../../util/folderManager';
import { cloneDeep } from '../../../util/iteratees';
import { clearMemoryCache } from '../../../util/mediaLoader';
import {
  ACCOUNT_SLOT, getAccountSlots, getAccountSlotUrl, loadSlotSession,
} from '../../../util/multiaccount';
import { unsubscribe } from '../../../util/notifications';
import { parseJsonWithBigInt } from '../../../util/numbers';
import {
  abortPasscodeDisable,
  addPasskeyToMeta,
  changePasscode,
  claimPasscodeDisable,
  clearLegacyEncryptedSession,
  clearLegacyEncryptedSessionIfAllowed,
  clearPlaintextSessionStorage,
  collectSessionStorageSnapshot,
  commitPasscodeDisable,
  createPasscode,
  decryptLegacySession,
  forgetDek,
  getDek,
  getDekGeneration,
  hasLegacyEncryptedSession,
  hasOtherSlotWalletVaultSecrets,
  InvalidPasscodeError,
  listWalletVaultSecrets,
  loadPasscodeMeta,
  markPasscodeLocked,
  PasscodeDataCorruptedError,
  readGlobalsVaultForSlot,
  refreshSessionsVault,
  removePasskeyFromMeta,
  removeWalletVaultSecretsNow,
  requestPasscodeStateLock,
  resetInvalidPasscodeAttempts,
  restoreMissingSessionsFromVault,
  restoreSessionsFromVault,
  restoreSessionsToPersistentStorage,
  setDek,
  unlockDekWithPasscode,
  unlockDekWithPasskeyKek,
  updatePasscodeMeta,
  verifyPasscode,
  writeGlobalsVaultForSlot,
} from '../../../util/passcode';
import {
  broadcastPasscodeSessionsChanged,
  broadcastPasscodeState,
  requestDekFromOtherTabs,
} from '../../../util/passcode/channel';
import {
  createUnlockPasskey, getPasskeyKek, signalUnknownUnlockPasskey,
} from '../../../util/passcode/passkey';
import {
  enableEncryptedSessionStore,
  resetSessionStore,
} from '../../../util/passcode/sessionStore';
import { getPendingWebLogin } from '../../../util/routing';
import { pause } from '../../../util/schedulers';
import { clearAllStoredSessions, storeSession, updateSessionUserId } from '../../../util/sessions';
import {
  clearLockScreenWallpaperBlobs,
  clearPlaintextWallpaperBlobs,
  encryptWallpaperBlobs,
  restoreWallpaperBlobsFromPasscode,
  syncLockScreenWallpaperBlobs,
} from '../../../util/wallpaperStorage';
import { interruptWebLogin } from '../../../util/webLogin';
import { handoffWebLogin } from '../../../util/webLoginHandoff';
import { closeApi } from '../../../api/gramjs';
import {
  cacheGlobalForSlot,
  cacheSharedState,
  forceUpdateCache,
  loadCachedGlobalForSlot,
  migrateCache,
  removeAllGlobalCaches,
  serializeGlobal,
} from '../../cache';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import { INITIAL_GLOBAL_STATE } from '../../initialState';
import { clearGlobalForLockScreen, clearPasscodeSettings, updatePasscodeSettings } from '../../reducers';
import { updateWallet } from '../../reducers/wallet';
import { selectTabState } from '../../selectors';

const WRONG_PASSCODE_ERROR: RegularLangFnParameters = { key: 'PasscodeWrong' };
const TOO_MANY_ATTEMPTS_ERROR: RegularLangFnParameters = { key: 'PasscodeTooManyAttempts' };
const PASSKEY_ERROR: RegularLangFnParameters = { key: 'PasscodePasskeyError' };
const SOMETHING_WENT_WRONG_ERROR: RegularLangFnParameters = { key: 'SomethingWentWrong' };

const MAX_INVALID_ATTEMPTS = 5;
const INVALID_ATTEMPTS_TIMEOUT_BASE_MS = 30 * 1000;
const INVALID_ATTEMPTS_TIMEOUT_MAX_MS = 5 * 60 * 1000;
const API_TEARDOWN_TIMEOUT_MS = 3000;

let apiTeardownPromise: Promise<void> | undefined;

addActionHandler('setPasscode', async (global, actions, payload): Promise<void> => {
  const { passcode, tabId = getCurrentTabId() } = payload;
  let isNewPasscode = false;
  let hadPasskey = false;
  let setupGeneration: string | undefined;

  setPasscodeSettings({ isLoading: true });
  try {
    await requestPasscodeStateLock(async () => {
      const meta = await loadPasscodeMeta();
      if (meta) {
        global = getGlobal();
        await writeGlobalsVaultForSlot(ACCOUNT_SLOT, serializeGlobal(global));
        await refreshSessionsVault();
        const result = await changePasscode(passcode);
        hadPasskey = result.hadPasskey;
        localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'false');
        broadcastPasscodeState(getDek(), result.generation);
        return;
      }

      isNewPasscode = true;
      localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'enabling');
      global = getGlobal();
      const snapshots = await collectGlobalSnapshots(global);
      const context = await createPasscode(passcode, snapshots);
      setupGeneration = context.generation;
      await finishPasscodeSetup(context);
    });

    setPasscodeSettings({
      hasPasscode: true,
      hasPasskey: false,
      errorKey: undefined,
      isLoading: false,
    });
    forceUpdateCache();
    if (hadPasskey) {
      actions.showNotification({ message: { key: 'PasscodePasskeyRemovedChange' }, tabId });
    }
  } catch (err) {
    if (isNewPasscode) {
      if (await failClosedAfterPasscodeSetup(setupGeneration)) {
        window.location.reload();
        return;
      }
      resetSessionStore();
      localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
    }

    setPasscodeSettings({ isLoading: false });

    actions.showNotification({
      message: { key: 'SomethingWentWrong' },
      tabId,
    });
    global = getGlobal();
    const screen = global.passcode.hasPasscode
      ? SettingsScreens.PasscodeEnabled
      : SettingsScreens.PasscodeDisabled;
    actions.openSettingsScreen({ screen, tabId });
  }
});

addActionHandler('clearPasscode', async (global, actions, payload): Promise<void> => {
  const { shouldDropWalletKeys } = payload || {};
  let passkeyCredentialId: number[] | undefined;
  const isDisabled = await requestPasscodeStateLock(async () => {
    const generation = getDekGeneration();
    if (!generation) return false;

    // The wallet phrases go only together with the passcode, under the same lock
    const hasOwnWalletKeys = (await listWalletVaultSecrets(ACCOUNT_SLOT)).length > 0;

    if (hasOwnWalletKeys && !shouldDropWalletKeys) {
      actions.openWalletModal({ shouldReleaseKey: true, tabId: getCurrentTabId() });

      return false;
    }

    // The passcode is shared by every account, so it stays until each of them has dropped its phrases
    if (await hasOtherSlotWalletVaultSecrets(ACCOUNT_SLOT)) {
      if (hasOwnWalletKeys) {
        await removeWalletVaultSecretsNow(ACCOUNT_SLOT);
        global = getGlobal();
        global = updateWallet(global, { hasLocalSecret: false, savedWallets: undefined });
        setGlobal(global);
      }

      actions.showNotification({ message: { key: 'PasscodeWalletKeyOtherAccounts' }, tabId: getCurrentTabId() });

      return false;
    }

    global = getGlobal();
    await writeGlobalsVaultForSlot(ACCOUNT_SLOT, serializeGlobal(global));
    await refreshSessionsVault();
    if (!await claimPasscodeDisable(generation)) return false;
    localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'disabling');

    try {
      passkeyCredentialId = (await loadPasscodeMeta())?.passkey?.credentialId;
      global = getGlobal();
      await restoreGlobalCaches(global);
      await restoreWallpaperBlobsFromPasscode();
      await restoreSessionsToPersistentStorage(generation);
      await clearLegacyEncryptedSession();
      if (!await commitPasscodeDisable(generation) && await loadPasscodeMeta()) {
        throw new Error('[passcode] Failed to commit disable');
      }
      await clearLockScreenWallpaperBlobs().catch(() => undefined);
    } catch (err) {
      if (await abortPasscodeDisable(generation)) {
        try {
          localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'false');
          await restoreSessionsFromVault(generation);
          await protectPasscodeStorage();
          forceUpdateCache();
          broadcastPasscodeState(getDek(), generation);
        } catch (cleanupErr) {
          await lockPasscodeStateAfterFailure(generation, getDek());
          window.location.reload();
        }
      } else if (await loadPasscodeMeta()) {
        window.location.reload();
      }
      actions.showNotification({
        message: { key: 'PasscodeDataCorrupted' },
        tabId: getCurrentTabId(),
      });
      return false;
    }

    // The phrases went with the vault the commit above dropped
    if (hasOwnWalletKeys) {
      global = getGlobal();
      global = updateWallet(global, { hasLocalSecret: false, savedWallets: undefined });
      setGlobal(global);
    }

    localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
    broadcastPasscodeState();
    return true;
  });
  if (!isDisabled) return;
  if (passkeyCredentialId) signalUnknownUnlockPasskey(passkeyCredentialId);

  global = getGlobal();
  global = clearPasscodeSettings(global);
  setGlobal(global);
  forceUpdateCache();
  actions.openSettingsScreen({ screen: SettingsScreens.Privacy, tabId: getCurrentTabId() });
});

addActionHandler('lockScreen', async (global): Promise<void> => {
  if (!global.passcode.hasPasscode || global.passcode.isScreenLocked) return;
  let shouldLockCurrentTab = false;
  let lockCurrentTabPromise: Promise<void> | undefined;
  try {
    await requestPasscodeStateLock(async () => {
      const dek = getDek();
      const generation = getDekGeneration();
      if (!dek || !generation) {
        shouldLockCurrentTab = true;
        preparePasscodeForLock(generation);
        return;
      }

      const meta = await loadPasscodeMeta();
      if (!meta || meta.generation !== generation) {
        throw new PasscodeDataCorruptedError('[passcode] Passcode state changed while locking');
      }
      if (meta.isDisabling) return;
      if (meta.isLocked) {
        shouldLockCurrentTab = true;
        preparePasscodeForLock(generation);
        return;
      }

      global = getGlobal();
      await writeGlobalsVaultForSlot(ACCOUNT_SLOT, serializeGlobal(global));
      await refreshSessionsVault();
      global = getGlobal();
      await updateLockScreenWallpaperCache(global).catch(logPasscodeWarning);
      const lockEpoch = await markPasscodeLocked(generation);
      if (lockEpoch === undefined) {
        throw new PasscodeDataCorruptedError('[passcode] Failed to mark passcode locked');
      }
      shouldLockCurrentTab = true;
      localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'true');

      broadcastPasscodeState(dek, generation);
      forgetDek(generation);
      clearAllStoredSessions();
      lockCurrentTabPromise = lockCurrentTab();
    });
  } catch (err) {
    logPasscodeWarning(err);
    shouldLockCurrentTab = true;
    const generation = getDekGeneration();
    preparePasscodeForLock(generation);
    lockCurrentTabPromise ||= lockCurrentTab();
  } finally {
    if (shouldLockCurrentTab) {
      await (lockCurrentTabPromise || lockCurrentTab());
      await purgePasscodeCaches().catch(logPasscodeWarning);
    }
  }
});

addActionHandler('unlockScreen', async (global, actions, payload): Promise<void> => {
  const { passcode } = payload;
  if (global.passcode.isLoading) return;

  setPasscodeSettings({ isLoading: true, errorKey: undefined });

  let meta: Awaited<ReturnType<typeof loadPasscodeMeta>>;
  try {
    meta = await loadPasscodeMeta();
  } catch (err) {
    setPasscodeSettings({ isLoading: false, errorKey: SOMETHING_WENT_WRONG_ERROR });
    return;
  }
  if (meta?.isDisabling) {
    setPasscodeSettings({ isLoading: false });
    return;
  }
  if (!meta) {
    global = getGlobal();
    const { timeoutUntil } = global.passcode;
    if (timeoutUntil && Date.now() < timeoutUntil) {
      setPasscodeSettings({
        errorKey: TOO_MANY_ATTEMPTS_ERROR,
        timeoutUntil,
        isLoading: false,
      });
      return;
    }

    if (await hasLegacyEncryptedSession()) {
      if (ACCOUNT_SLOT) {
        if (!await handoffWebLogin(getAccountSlotUrl(1))) {
          window.location.replace(getAccountSlotUrl(1));
        }
        return;
      }
      await unlockLegacySession(passcode);
      return;
    }

    setPasscodeSettings({ isLoading: false, isDataCorrupted: true });
    return;
  }

  if (meta.timeoutUntil && Date.now() < meta.timeoutUntil) {
    setPasscodeSettings({
      errorKey: TOO_MANY_ATTEMPTS_ERROR,
      timeoutUntil: meta.timeoutUntil,
      isLoading: false,
    });
    return;
  }

  let dek: ArrayBuffer;
  try {
    dek = await unlockDekWithPasscode(passcode);
  } catch (err) {
    if (err instanceof InvalidPasscodeError) {
      await logInvalidAttempt(meta.generation);
    } else if (err instanceof PasscodeDataCorruptedError) {
      setPasscodeSettings({ isLoading: false, isDataCorrupted: true });
    } else {
      setPasscodeSettings({ isLoading: false, errorKey: SOMETHING_WENT_WRONG_ERROR });
    }
    return;
  }

  await finishUnlock(dek, meta.generation, meta.lockEpoch);
});

addActionHandler('unlockScreenWithPasskey', async (global, _actions, payload): Promise<void> => {
  if (global.passcode.isLoading) return;

  const isConditional = payload?.isConditional;
  let shouldHandleError = !isConditional;
  if (!isConditional) setPasscodeSettings({ isLoading: true });

  try {
    const meta = await loadPasscodeMeta();
    if (!meta?.passkey) {
      if (!isConditional) setPasscodeSettings({ isLoading: false });
      return;
    }

    // Authenticator user verification remains available while typed passcode attempts are rate-limited
    const kek = await getPasskeyKek(meta.passkey.credentialId, meta.passkey.prfSalt, isConditional);
    if (isConditional) {
      global = getGlobal();
      if (global.passcode.isLoading || !global.passcode.isScreenLocked) return;

      shouldHandleError = true;
      setPasscodeSettings({ isLoading: true });
    }

    const dek = await unlockDekWithPasskeyKek(kek);
    await finishUnlock(dek, meta.generation, meta.lockEpoch);
  } catch (err) {
    if (!shouldHandleError) return;

    setPasscodeSettings({
      isLoading: false,
      errorKey: PASSKEY_ERROR,
    });
  }
});

addActionHandler('setupUnlockPasskey', async (global, actions, payload): Promise<void> => {
  if (!getDek() || global.passcode.isLoading || global.passcode.hasPasskey) return;
  const { passcode, tabId = getCurrentTabId() } = payload;

  setPasscodeSettings({ isLoading: true, errorKey: undefined });
  if (!await verifyCurrentPasscode(passcode)) return;

  try {
    const result = await createUnlockPasskey();
    if (!result) {
      actions.showNotification({ message: { key: 'PasscodePasskeyUnsupported' }, tabId });
      return;
    }

    try {
      await requestPasscodeStateLock(() => (
        addPasskeyToMeta(result.credentialId, result.prfSalt, result.kek)
      ));
    } catch (err) {
      signalUnknownUnlockPasskey(result.credentialId);
      throw err;
    }

    setPasscodeSettings({ hasPasskey: true });

    broadcastPasscodeState();
    actions.openSettingsScreen({ screen: SettingsScreens.PasscodeEnabled, tabId });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      actions.openSettingsScreen({ screen: SettingsScreens.PasscodeEnabled, tabId });
      return;
    }

    actions.showNotification({ message: { key: 'PasscodePasskeyError' }, tabId });
  } finally {
    setPasscodeSettings({ isLoading: false });
  }
});

addActionHandler('removeUnlockPasskey', async (global, actions, payload): Promise<void> => {
  if (!getDek() || global.passcode.isLoading || !global.passcode.hasPasskey) return;
  const { passcode, tabId = getCurrentTabId() } = payload;

  setPasscodeSettings({ isLoading: true, errorKey: undefined });
  if (!await verifyCurrentPasscode(passcode)) return;

  try {
    const credentialId = await requestPasscodeStateLock(async () => {
      const passkey = (await loadPasscodeMeta())?.passkey;
      if (!passkey || !await removePasskeyFromMeta()) return undefined;
      return passkey.credentialId;
    });
    if (!credentialId) return;

    setPasscodeSettings({ hasPasskey: false });

    broadcastPasscodeState();
    signalUnknownUnlockPasskey(credentialId);
    actions.openSettingsScreen({ screen: SettingsScreens.PasscodeEnabled, tabId });
  } catch (err) {
    actions.showNotification({ message: { key: 'SomethingWentWrong' }, tabId });
  } finally {
    setPasscodeSettings({ isLoading: false });
  }
});

addActionHandler('setPasscodeKeepBackground', async (global, actions, payload): Promise<void> => {
  const { shouldKeep } = payload;

  try {
    await requestPasscodeStateLock(async () => {
      if (!await loadPasscodeMeta() || !getDek()) return;

      global = getGlobal();
      if (shouldKeep) {
        await syncSelectedLockScreenWallpaperBlobs(global);
      } else {
        await clearLockScreenWallpaperBlobs();
      }
      actions.setSharedSettingOption({ shouldKeepLockScreenBackground: shouldKeep });
    });
  } catch (err) {
    actions.showNotification({ message: { key: 'SomethingWentWrong' }, tabId: getCurrentTabId() });
  }
});

addActionHandler('setPasscodeAutolockDuration', async (global, actions, payload): Promise<void> => {
  const { duration } = payload;

  const isUpdated = await requestPasscodeStateLock(() => (
    updatePasscodeMeta({ autolockDuration: duration }, getDekGeneration())
  ));
  if (!isUpdated) return;

  setPasscodeSettings({ autolockDuration: duration });

  broadcastPasscodeState();
});

addActionHandler('onPasscodeStateChangedRemotely', async (global, actions, payload): Promise<void> => {
  await requestPasscodeStateLock(async () => {
    const meta = await loadPasscodeMeta();
    global = getGlobal();
    if (meta?.isDisabling) return;
    if (!meta) {
      forgetDek();
      resetSessionStore();
      localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
      if (global.passcode.isScreenLocked) {
        window.location.reload();
        return;
      }
      global = clearPasscodeSettings(global);
      setGlobal(global);
      forceUpdateCache();
      return;
    }

    const previousGeneration = getDekGeneration();
    let dek = previousGeneration === meta.generation ? getDek() : undefined;
    if (!dek && payload.generation === meta.generation && payload.dek) {
      dek = payload.dek;
    }
    if (!dek && !meta.isLocked) {
      dek = await requestDekFromOtherTabs(meta.generation);
      global = getGlobal();
    }
    if (dek) setDek(dek, meta.generation);

    if (dek && !meta.isLocked && !global.passcode.hasPasscode) {
      if (selectTabState(global, getCurrentTabId())?.isMasterTab) {
        await writeGlobalsVaultForSlot(ACCOUNT_SLOT, serializeGlobal(global));
      }
      global = getGlobal();
      await cacheSharedState(global.sharedState);
      await removeAllGlobalCaches();
      global = getGlobal();
    }

    if (meta.isLocked || !dek) {
      if (
        meta.isLocked
        && !global.passcode.isScreenLocked
        && dek
        && selectTabState(global, getCurrentTabId())?.isMasterTab
      ) {
        await writeGlobalsVaultForSlot(ACCOUNT_SLOT, serializeGlobal(global));
      }
      global = getGlobal();
      const wasScreenLocked = global.passcode.isScreenLocked;

      forgetDek(meta.generation);
      clearAllStoredSessions();
      setPasscodeSettings({
        hasPasscode: true,
        isScreenLocked: true,
        hasPasskey: Boolean(meta.passkey),
        autolockDuration: meta.autolockDuration,
      });
      if (!wasScreenLocked) await lockCurrentTab();
      return;
    }

    try {
      if (previousGeneration !== meta.generation) {
        await restoreSessionsFromVault(meta.generation);
        if (await refreshSessionsVault()) broadcastPasscodeSessionsChanged(meta.generation);
      } else {
        await restoreMissingSessionsFromVault();
      }
    } catch (err) {
      forgetDek(meta.generation);
      clearAllStoredSessions();
      setPasscodeSettings({ isDataCorrupted: true });
      await lockCurrentTab();
      return;
    }

    global = getGlobal();

    if (global.passcode.isScreenLocked) {
      await applyUnlockedState(await readGlobalJson(), undefined, meta);
      return;
    }

    setPasscodeSettings({
      hasPasscode: true,
      hasPasskey: Boolean(meta.passkey),
      autolockDuration: meta.autolockDuration,
    });
    forceUpdateCache();
  });
});

addActionHandler('onPasscodeSessionsChanged', async (global, actions, payload): Promise<void> => {
  const generation = getDekGeneration();
  if (!generation || payload.generation !== generation || global.passcode.isScreenLocked) return;

  await restoreSessionsFromVault(generation).catch(() => undefined);
});

addActionHandler('resetInvalidUnlockAttempts', async (global, actions, payload): Promise<void> => {
  const { timeoutUntil } = payload;
  if (Date.now() < timeoutUntil) return;

  const invalidAttemptsCount = await requestPasscodeStateLock(async () => {
    const meta = await loadPasscodeMeta();
    if (!meta) return 0;
    if (!meta.timeoutUntil) return meta.invalidAttemptsCount || 0;
    if (meta.timeoutUntil !== timeoutUntil) return undefined;
    return await resetInvalidPasscodeAttempts(timeoutUntil) ? meta.invalidAttemptsCount || 0 : undefined;
  });
  if (invalidAttemptsCount === undefined) return;

  global = getGlobal();
  if (global.passcode.timeoutUntil !== timeoutUntil) return;

  setPasscodeSettings({
    invalidAttemptsCount,
    timeoutUntil: undefined,
    errorKey: undefined,
  });
});

addActionHandler('setPasscodeError', (global, actions, payload): ActionReturnType => {
  const { errorKey } = payload;

  return updatePasscodeSettings(global, { errorKey });
});

addActionHandler('clearPasscodeError', (global): ActionReturnType => {
  return updatePasscodeSettings(global, { errorKey: undefined });
});

async function finishUnlock(dek: ArrayBuffer, generation: string, lockEpoch: number) {
  await requestPasscodeStateLock(async () => {
    const meta = await loadPasscodeMeta();
    if (
      meta?.generation !== generation
      || meta.lockEpoch !== lockEpoch
      || meta.isDisabling
    ) {
      setPasscodeSettings({ isLoading: false, errorKey: SOMETHING_WENT_WRONG_ERROR });
      return;
    }

    setDek(dek, generation);
    let globalJson: string;
    try {
      await restoreSessionsFromVault(generation);
      globalJson = await readGlobalJson();
    } catch (err) {
      abortUnlock(generation, true);
      return;
    }
    const isUnlocked = await updatePasscodeMeta({
      isLocked: false,
      invalidAttemptsCount: 0,
      timeoutUntil: undefined,
    }, generation);
    if (!isUnlocked) {
      abortUnlock(generation);
      return;
    }
    localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'false');
    broadcastPasscodeState(dek, generation);
    await applyUnlockedState(globalJson, undefined, meta);
  });
}

async function readGlobalJson() {
  const globalJson = await readGlobalsVaultForSlot(ACCOUNT_SLOT);
  if (!globalJson) return serializeGlobal(cloneDeep(INITIAL_GLOBAL_STATE));

  await clearLegacyEncryptedSessionIfAllowed().catch(() => undefined);
  return globalJson;
}

function abortUnlock(generation: string, isDataCorrupted?: boolean) {
  forgetDek(generation);
  clearAllStoredSessions();
  setPasscodeSettings({ isLoading: false, isDataCorrupted });
}

async function unlockLegacySession(passcode: string) {
  let sessionJson: string;
  let globalJson: string;
  let sharedStateJson: string | undefined;
  try {
    ({ sessionJson, globalJson, sharedStateJson } = await decryptLegacySession(passcode));
  } catch (err) {
    if (err instanceof InvalidPasscodeError) {
      const global = getGlobal();
      const invalidAttempt = buildInvalidAttempt(global.passcode.invalidAttemptsCount);
      setPasscodeSettings({
        ...invalidAttempt,
        isLoading: false,
      });
    } else {
      setPasscodeSettings({ isDataCorrupted: true });
    }
    return;
  }

  const sharedState = parseLegacySharedState(sharedStateJson);
  let migrationGeneration: string | undefined;
  try {
    const legacyGlobal = parseJsonWithBigInt<GlobalState>(globalJson);
    migrateCache(legacyGlobal, cloneDeep(INITIAL_GLOBAL_STATE));
    if (sharedState) legacyGlobal.sharedState = sharedState;
    if (sharedState) await cacheSharedState(sharedState);
    const session = parseJsonWithBigInt<Parameters<typeof storeSession>[0] & { userId?: string }>(sessionJson);
    enableEncryptedSessionStore(collectSessionStorageSnapshot());
    await storeSession(session);
    if (session.userId) await updateSessionUserId(session.userId);

    const migration = await requestPasscodeStateLock(async () => {
      if (await loadPasscodeMeta()) return undefined;

      localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'enabling');
      const context = await createPasscode(passcode, await collectGlobalSnapshots(legacyGlobal));
      migrationGeneration = context.generation;
      await finishPasscodeSetup(context);
      await clearLegacyEncryptedSessionIfAllowed().catch(() => undefined);
      return true;
    });
    if (!migration) {
      window.location.reload();
      return;
    }
  } catch (err) {
    if (await failClosedAfterPasscodeSetup(migrationGeneration)) {
      window.location.reload();
      return;
    }
    resetSessionStore();
    setPasscodeSettings({ isDataCorrupted: true });
    return;
  }

  await applyUnlockedState(globalJson, sharedState);
}

async function failClosedAfterPasscodeSetup(expectedGeneration?: string) {
  return requestPasscodeStateLock(async () => {
    const meta = await loadPasscodeMeta();
    if (!meta || !expectedGeneration || meta.generation !== expectedGeneration) {
      forgetDek(expectedGeneration);
      return false;
    }

    const dek = getDekGeneration() === meta.generation ? getDek() : undefined;
    await lockPasscodeStateAfterFailure(meta.generation, dek);
    return true;
  });
}

async function lockPasscodeStateAfterFailure(generation: string, dek?: ArrayBuffer) {
  await markPasscodeLocked(generation);
  localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'true');
  await removeAllGlobalCaches().catch(() => undefined);
  await clearPlaintextWallpaperBlobs().catch(() => undefined);
  await purgePasscodeCaches().catch(() => undefined);
  broadcastPasscodeState(dek, generation);
  forgetDek(generation);
  clearAllStoredSessions();
}

async function finishPasscodeSetup({
  dek, generation,
}: Awaited<ReturnType<typeof createPasscode>>) {
  await protectPasscodeStorage();
  localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'false');
  broadcastPasscodeState(dek, generation);
}

async function protectPasscodeStorage() {
  await encryptWallpaperBlobs();
  let global = getGlobal();
  await updateLockScreenWallpaperCache(global).catch(logPasscodeWarning);
  global = getGlobal();
  await cacheSharedState(global.sharedState);
  await removeAllGlobalCaches();
  await purgePasscodeCaches();
  clearPlaintextSessionStorage();
}

async function updateLockScreenWallpaperCache(global: GlobalState) {
  if (!global.sharedState.settings.shouldKeepLockScreenBackground) {
    await clearLockScreenWallpaperBlobs();
    return;
  }

  await syncSelectedLockScreenWallpaperBlobs(global);
}

async function syncSelectedLockScreenWallpaperBlobs(global: GlobalState) {
  const selectedBackgrounds = Object.values(global.sharedState.settings.themes)
    .map((themeSettings) => themeSettings?.background)
    .filter((background): background is string => Boolean(background));
  await syncLockScreenWallpaperBlobs(selectedBackgrounds);
}

function logPasscodeWarning(err: unknown) {
  // eslint-disable-next-line no-console
  console.warn(err);
}

function parseLegacySharedState(sharedStateJson?: string): GlobalState['sharedState'] | undefined {
  if (!sharedStateJson) return undefined;

  try {
    return parseJsonWithBigInt<GlobalState['sharedState']>(sharedStateJson);
  } catch (err) {
    return undefined;
  }
}

async function collectGlobalSnapshots(currentGlobal: GlobalState) {
  const currentSlot = ACCOUNT_SLOT || 1;
  const snapshots: Parameters<typeof createPasscode>[1] = [];
  const accountSlots = new Set([currentSlot, ...getAccountSlots()]);

  for (const slot of accountSlots) {
    const session = loadSlotSession(slot);
    let slotGlobal = slot === currentSlot ? currentGlobal : await loadCachedGlobalForSlot(slot);
    if (!slotGlobal && !session) continue;

    if (!slotGlobal) {
      slotGlobal = cloneDeep(INITIAL_GLOBAL_STATE);
      slotGlobal.currentUserId = session!.userId;
      slotGlobal.sharedState = currentGlobal.sharedState;
    } else if (slotGlobal !== currentGlobal) {
      migrateCache(slotGlobal, cloneDeep(INITIAL_GLOBAL_STATE));
    }

    slotGlobal = updatePasscodeSettings(slotGlobal, {
      hasPasscode: true,
      isScreenLocked: false,
      errorKey: undefined,
      isLoading: false,
    });
    snapshots.push({ globalJson: serializeGlobal(slotGlobal), slot });
  }

  return snapshots;
}

async function restoreGlobalCaches(currentGlobal: GlobalState) {
  const currentSlot = ACCOUNT_SLOT || 1;
  const globalsBySlot: Array<{ global: GlobalState; slot: number }> = [];
  const accountSlots = new Set([currentSlot, ...getAccountSlots()]);

  for (const slot of accountSlots) {
    const session = loadSlotSession(slot);
    if (slot !== currentSlot && !session) continue;

    let global: GlobalState;
    if (slot === currentSlot) {
      global = currentGlobal;
    } else {
      const globalJson = await readGlobalsVaultForSlot(slot);
      global = globalJson ? parseJsonWithBigInt<GlobalState>(globalJson) : cloneDeep(INITIAL_GLOBAL_STATE);
      if (!globalJson) global.currentUserId = session!.userId;
      global.sharedState = currentGlobal.sharedState;
      migrateCache(global, cloneDeep(INITIAL_GLOBAL_STATE));
    }
    global = clearPasscodeSettings(global);
    globalsBySlot.push({ global, slot });
  }

  await Promise.all(globalsBySlot.map(({ global, slot }) => cacheGlobalForSlot(slot, global)));
}

// Under the same attempt limit as the lock screen, or the wallet screens would let the passcode be guessed freely.
// The whole check runs under the lock. Tabs checking at once would otherwise all pass the timeout and try their
// passcodes before any attempt is counted. The lock is not reentrant, so the records are updated directly.
export function verifyPasscodeWithLimit(
  passcode: string,
): Promise<'PASSCODE_INVALID' | 'PASSCODE_LOCKED' | undefined> {
  return requestPasscodeStateLock(async () => {
    const meta = await loadPasscodeMeta();
    if (!meta) return 'PASSCODE_INVALID';

    if (meta.timeoutUntil && Date.now() < meta.timeoutUntil) return 'PASSCODE_LOCKED';

    try {
      await unlockDekWithPasscode(passcode);
    } catch (err) {
      if (err instanceof InvalidPasscodeError) {
        await recordInvalidAttempt(meta.generation).catch(() => undefined);
      }

      return 'PASSCODE_INVALID';
    }

    // A bookkeeping failure must not turn a right passcode into a refusal
    if (meta.invalidAttemptsCount) {
      await updatePasscodeMeta({ invalidAttemptsCount: 0, timeoutUntil: undefined }, meta.generation)
        .catch(() => undefined);
    }

    return undefined;
  });
}

async function logInvalidAttempt(generation: string) {
  const invalidAttempt = await registerInvalidAttempt(generation);

  if (!invalidAttempt) {
    setPasscodeSettings({ isLoading: false, errorKey: SOMETHING_WENT_WRONG_ERROR });
    return;
  }

  setPasscodeSettings({ ...invalidAttempt, isLoading: false });
}

async function registerInvalidAttempt(generation: string) {
  try {
    return await requestPasscodeStateLock(() => recordInvalidAttempt(generation));
  } catch (err) {
    return undefined;
  }
}

// The caller holds the passcode state lock
async function recordInvalidAttempt(generation: string) {
  let invalidAttempt: ReturnType<typeof buildInvalidAttempt> | undefined;

  const isUpdated = await updatePasscodeMeta((meta) => {
    invalidAttempt = buildInvalidAttempt(meta.invalidAttemptsCount);
    return {
      invalidAttemptsCount: invalidAttempt.invalidAttemptsCount,
      timeoutUntil: invalidAttempt.timeoutUntil,
    };
  }, generation);

  return isUpdated ? invalidAttempt : undefined;
}

function buildInvalidAttempt(previousAttemptsCount = 0) {
  const invalidAttemptsCount = previousAttemptsCount + 1;
  const timeoutUntil = invalidAttemptsCount >= MAX_INVALID_ATTEMPTS
    ? Date.now() + Math.min(
      INVALID_ATTEMPTS_TIMEOUT_BASE_MS * (2 ** (invalidAttemptsCount - MAX_INVALID_ATTEMPTS)),
      INVALID_ATTEMPTS_TIMEOUT_MAX_MS,
    )
    : undefined;
  return {
    invalidAttemptsCount,
    timeoutUntil,
    errorKey: timeoutUntil ? TOO_MANY_ATTEMPTS_ERROR : WRONG_PASSCODE_ERROR,
  };
}

async function applyUnlockedState(
  globalJson: string,
  sharedState?: GlobalState['sharedState'],
  meta?: Awaited<ReturnType<typeof loadPasscodeMeta>>,
) {
  await waitForApiTeardown();

  const actions = getActions();

  let global = getGlobal();
  const beforeTabStates = Object.values(global.byTabId);
  const previousGlobal = global;
  global = parseJsonWithBigInt<GlobalState>(globalJson);
  global.byTabId = previousGlobal.byTabId;
  global.sharedState = sharedState || previousGlobal.sharedState;
  migrateCache(global, cloneDeep(INITIAL_GLOBAL_STATE));

  global = updatePasscodeSettings(global, {
    hasPasscode: true,
    isScreenLocked: false,
    hasPasskey: meta ? Boolean(meta.passkey) : global.passcode.hasPasskey,
    autolockDuration: meta ? meta.autolockDuration : global.passcode.autolockDuration,
    errorKey: undefined,
    invalidAttemptsCount: 0,
    timeoutUntil: undefined,
    isLoading: false,
    isDataCorrupted: undefined,
  });
  setGlobal(global);
  updateFolderManager(global);

  beforeTabStates.forEach(({ id: tabId, isMasterTab }) => actions.init({ tabId, isMasterTab }));
  beforeTabStates.forEach(({ id: tabId }) => actions.setIsUiReady({ uiReadyState: 2, tabId }));
  if (selectTabState(global, getCurrentTabId())?.isMasterTab) {
    actions.initApi();
  } else if (getPendingWebLogin()) {
    reestablishMasterToSelf();
  }
  forceUpdateCache();
}

async function lockCurrentTab() {
  interruptWebLogin();
  setPasscodeSettings({
    isScreenLocked: true,
    invalidAttemptsCount: 0,
    timeoutUntil: undefined,
    errorKey: undefined,
  });

  updateAppBadge(0);
  clearMemoryCache();

  setTimeout(() => {
    let global = getGlobal();
    if (!global.passcode.isScreenLocked) return;
    global = clearGlobalForLockScreen(global);
    setGlobal(global);
  }, LOCK_SCREEN_ANIMATION_DURATION_MS);

  const teardownPromise = teardownApi();
  apiTeardownPromise = teardownPromise;
  try {
    await teardownPromise;
  } finally {
    if (apiTeardownPromise === teardownPromise) {
      apiTeardownPromise = undefined;
    }
  }
  clearMemoryCache();
}

function preparePasscodeForLock(generation?: string) {
  localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'true');
  forgetDek(generation);
  clearAllStoredSessions();
}

async function teardownApi() {
  await Promise.race([unsubscribe(), pause(API_TEARDOWN_TIMEOUT_MS)]).catch(() => undefined);
  await closeApi(true);
}

async function waitForApiTeardown() {
  while (apiTeardownPromise) {
    await apiTeardownPromise;
  }
}

async function verifyCurrentPasscode(passcode: string) {
  if (await verifyPasscode(passcode)) return true;

  setPasscodeSettings({ isLoading: false, errorKey: WRONG_PASSCODE_ERROR });
  return false;
}

function setPasscodeSettings(settings: Partial<GlobalState['passcode']>) {
  let global = getGlobal();
  global = updatePasscodeSettings(global, settings);
  setGlobal(global);
}
