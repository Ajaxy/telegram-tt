import {
  DC_IDS,
  SESSION_ACCOUNT_PREFIX,
  SESSION_LEGACY_USER_KEY,
  SHOULD_DELETE_LEGACY_PASSCODE_DATA,
} from '../../config';
import { PASSCODE_IDB_STORE } from '../browser/idb';
import {
  loadPasscodeMeta,
  PASSCODE_META_KEY,
  type PasscodeMeta,
  requestPasscodeStateLock,
} from './meta';
import { clearPasscodeNavigationDek } from './navigation';
import {
  clearFlushedSessionKeys,
  clearPersistentSessionValues,
  collectSessionValues,
  disableEncryptedSessionStore,
  enableEncryptedSessionStore,
  getDirtySessionKeys,
  getSessionValueKeys,
  isEncryptedSessionStoreHydrated,
  lockEncryptedSessionStore,
  mergeEncryptedSessionStore,
  replaceEncryptedSessionStore,
  resetSessionStore,
} from './sessionStore';

const IV_LENGTH = 12;
const KDF_SALT_LENGTH = 16;
const KDF_ITERATIONS = 600000;
const DEK_LENGTH = 32;
const META_VERSION = 3;
const WALLPAPER_TYPE_LENGTH_BYTES = 4;

const SESSIONS_VAULT_KEY_PREFIX = 'sessionsVault_';
const GLOBALS_VAULT_KEY_PREFIX = 'globalsVault_';
const WALLPAPERS_VAULT_KEY_PREFIX = 'wallpapersVault_';
const WALLET_VAULT_KEY_PREFIX = 'walletVault_';
const PASSCODE_SESSION_LOCK_NAME = 'tt-passcode-session';
const PASSCODE_GLOBALS_LOCK_NAME = 'tt-passcode-globals';

const LEGACY_SALT = 'harder better faster stronger';
const LEGACY_SESSION_KEY = 'sessionEncrypted';
const LEGACY_GLOBAL_KEY = 'globalEncrypted';
const LEGACY_SHARED_STATE_KEY = 'sharedStateEncrypted';

type GlobalSnapshot = {
  globalJson: string;
  slot: number;
};

type PasscodeMetaUpdate = Partial<PasscodeMeta> | ((meta: PasscodeMeta) => Partial<PasscodeMeta>);

type SessionChanges = {
  changedKeys: string[];
  changedValues: Record<string, string>;
  dek: ArrayBuffer;
  generation: string;
};

export { loadPasscodeMeta, requestPasscodeStateLock } from './meta';
export type { PasscodeMeta } from './meta';

export class InvalidPasscodeError extends Error {}
export class PasscodeDataCorruptedError extends Error {}

let currentDek: ArrayBuffer | undefined;
let currentDekGeneration: string | undefined;

export function getDek() {
  return currentDek;
}

export function getDekGeneration() {
  return currentDekGeneration;
}

export function setDek(dek: ArrayBuffer, generation: string) {
  const previousGeneration = currentDekGeneration;
  currentDek = dek;
  currentDekGeneration = generation;
  if (previousGeneration && previousGeneration !== generation) {
    clearPasscodeNavigationDek(previousGeneration);
  }
}

export function forgetDek(expectedGeneration?: string) {
  if (expectedGeneration && currentDekGeneration !== expectedGeneration) {
    clearPasscodeNavigationDek(expectedGeneration);
    return;
  }
  currentDek = undefined;
  currentDekGeneration = undefined;
  clearPasscodeNavigationDek(expectedGeneration);
}

export function lockPasscodeSessionStore() {
  lockEncryptedSessionStore();
  clearPersistentSessionValues(getSessionStorageKeys());
}

export function clearPlaintextSessionStorage() {
  clearPersistentSessionValues(getSessionStorageKeys());
}

export function updatePasscodeMeta(update: PasscodeMetaUpdate, expectedGeneration?: string) {
  return updatePasscodeMetaWhen(update, expectedGeneration, () => true);
}

export function claimPasscodeDisable(generation: string) {
  return updatePasscodeMetaWhen({ isDisabling: true }, generation, (meta) => (
    !meta.isLocked && !meta.isDisabling
  ));
}

export function abortPasscodeDisable(generation: string) {
  return updatePasscodeMetaWhen({ isDisabling: undefined }, generation, (meta) => (
    Boolean(meta.isDisabling)
  ));
}

export function markPasscodeLocked(generation: string) {
  let lockEpoch: number | undefined;
  return PASSCODE_IDB_STORE.update<PasscodeMeta | undefined>(PASSCODE_META_KEY, (meta) => {
    if (!meta || meta.generation !== generation || meta.isDisabling) return meta;
    if (meta.isLocked) {
      lockEpoch = meta.lockEpoch;
      return meta;
    }
    lockEpoch = meta.lockEpoch + 1;
    return {
      ...meta,
      lockEpoch,
      isLocked: true,
      invalidAttemptsCount: 0,
      timeoutUntil: undefined,
    };
  }).then(() => lockEpoch);
}

export function resetInvalidPasscodeAttempts(timeoutUntil: number) {
  return updatePasscodeMetaWhen({
    timeoutUntil: undefined,
  }, undefined, (meta) => (
    meta.timeoutUntil === timeoutUntil && Date.now() >= timeoutUntil
  ));
}

export async function commitPasscodeDisable(generation: string) {
  let isCommitted = false;
  await PASSCODE_IDB_STORE.update<PasscodeMeta | undefined>(PASSCODE_META_KEY, (meta) => {
    if (meta?.generation !== generation || !meta.isDisabling) return meta;
    isCommitted = true;
    return undefined;
  });
  if (!isCommitted) return false;

  forgetDek(generation);
  await removeVaultGeneration(generation);
  return true;
}

async function updatePasscodeMetaWhen(
  update: PasscodeMetaUpdate,
  expectedGeneration: string | undefined,
  canUpdate: (meta: PasscodeMeta) => boolean,
) {
  let isUpdated = false;
  await PASSCODE_IDB_STORE.update<PasscodeMeta | undefined>(PASSCODE_META_KEY, (meta) => {
    if (
      !meta
      || (expectedGeneration && meta.generation !== expectedGeneration)
      || !canUpdate(meta)
    ) return meta;
    isUpdated = true;
    const resolvedUpdate = typeof update === 'function' ? update(meta) : update;
    return { ...meta, ...resolvedUpdate };
  });
  return isUpdated;
}

export async function createPasscode(passcode: string, globalSnapshots: GlobalSnapshot[]) {
  if (!globalSnapshots.length) {
    throw new PasscodeDataCorruptedError('[passcode] Missing global snapshot');
  }

  const { dek, generation, meta } = await createPasscodeContext(passcode, 0);
  const sessionSnapshot = collectSessionStorageSnapshot();
  const entries = await encryptVaultEntries(dek, generation, sessionSnapshot, globalSnapshots, [], []);

  await PASSCODE_IDB_STORE.setMany([
    [PASSCODE_META_KEY, meta],
    ...entries,
  ]);
  setDek(dek, generation);
  enableEncryptedSessionStore(sessionSnapshot);
  clearPersistentSessionValues(getSessionStorageKeys());
  return { dek, generation };
}

export function changePasscode(passcode: string) {
  return navigator.locks.request(PASSCODE_SESSION_LOCK_NAME, () => changePasscodeNow(passcode));
}

async function changePasscodeNow(passcode: string) {
  const currentContext = await loadCurrentDekContext();
  const sessionSnapshot = await decryptSessionsVault();
  const globalSnapshots = await readGlobalSnapshots(currentContext);
  const wallpaperBlobs = await readWallpaperBlobs(currentContext);
  const walletSecrets = await readWalletSecrets(currentContext);

  const { dek, generation, meta } = await createPasscodeContext(
    passcode,
    currentContext.meta.lockEpoch,
    currentContext.meta.autolockDuration,
  );
  const entries = await encryptVaultEntries(
    dek, generation, sessionSnapshot, globalSnapshots, wallpaperBlobs, walletSecrets,
  );

  const latestMeta = await loadPasscodeMeta();
  if (
    latestMeta?.generation !== currentContext.generation
    || latestMeta.lockEpoch !== currentContext.meta.lockEpoch
    || latestMeta.isLocked
    || latestMeta.isDisabling
  ) {
    throw new PasscodeDataCorruptedError('[passcode] State changed while changing passcode');
  }

  await PASSCODE_IDB_STORE.setMany([[PASSCODE_META_KEY, meta], ...entries]);
  setDek(dek, generation);
  replaceEncryptedSessionStore(sessionSnapshot);
  await removeVaultGeneration(currentContext.generation);

  return { generation, hadPasskey: Boolean(currentContext.meta.passkey) };
}

export async function unlockDekWithPasscode(passcode: string) {
  const meta = await loadPasscodeMeta();
  if (!meta) {
    throw new PasscodeDataCorruptedError('[passcode] Missing meta');
  }

  const kek = await deriveKekFromPasscode(passcode, new Uint8Array(meta.kdfSalt), meta.kdfIterations);

  return unwrapDek(meta.wrappedDek, kek, meta, '[passcode] Invalid passcode');
}

export async function verifyPasscode(passcode: string) {
  try {
    await unlockDekWithPasscode(passcode);
    return true;
  } catch (err) {
    return false;
  }
}

export async function addPasskeyToMeta(credentialId: number[], prfSalt: number[], kekBytes: ArrayBuffer) {
  const { dek, generation, meta } = await loadCurrentDekContext();

  const kek = await importAesKey(kekBytes);
  const wrappedDek = await encryptVaultData(dek, kek, generation, PASSCODE_META_KEY);

  const isUpdated = await updatePasscodeMetaWhen({
    passkey: {
      credentialId,
      prfSalt,
      wrappedDek: Array.from(new Uint8Array(wrappedDek)),
    },
  }, generation, (latestMeta) => (
    !latestMeta.isLocked
    && !latestMeta.isDisabling
    && latestMeta.lockEpoch === meta.lockEpoch
  ));
  if (!isUpdated) throw new PasscodeDataCorruptedError('[passcode] Stale current key');
}

export function removePasskeyFromMeta() {
  return updatePasscodeMetaWhen({ passkey: undefined }, currentDekGeneration, (meta) => (
    !meta.isLocked && !meta.isDisabling
  ));
}

export async function unlockDekWithPasskeyKek(kekBytes: ArrayBuffer) {
  const meta = await loadPasscodeMeta();
  if (!meta?.passkey) {
    throw new PasscodeDataCorruptedError('[passcode] Missing passkey meta');
  }

  const kek = await importAesKey(kekBytes);

  return unwrapDek(meta.passkey.wrappedDek, kek, meta, '[passcode] Invalid passkey key');
}

export async function refreshSessionsVault() {
  return flushSessionStorageChanges(takeSessionChanges());
}

function takeSessionChanges(): SessionChanges | undefined {
  const dek = currentDek;
  const generation = currentDekGeneration;
  if (!dek || !generation) return undefined;

  const changedKeys = getDirtySessionKeys();
  if (!changedKeys.length) return undefined;
  const changedValues = collectSessionValues(changedKeys);

  return {
    changedKeys, changedValues, dek, generation,
  };
}

async function flushSessionStorageChanges(sessionChanges?: SessionChanges) {
  return navigator.locks.request(
    PASSCODE_SESSION_LOCK_NAME,
    async () => {
      if (!sessionChanges) return false;

      const {
        changedKeys, changedValues, dek, generation,
      } = sessionChanges;
      const isUpdated = await refreshSessionsVaultNow(changedKeys, changedValues, dek, generation);
      if (isUpdated) clearFlushedSessionKeys(changedKeys, changedValues);
      return isUpdated;
    },
  );
}

async function refreshSessionsVaultNow(
  changedKeys: string[],
  changedValues: Record<string, string>,
  dek: ArrayBuffer,
  generation: string,
) {
  const meta = await loadPasscodeMeta();
  // A session change captured while unlocked remains safe to persist into the encrypted vault after locking
  if (!meta || meta.generation !== generation || meta.isDisabling) return false;

  const snapshot = await decryptSessionsVaultWith(dek, generation);
  changedKeys.forEach((storageKey) => {
    const value = changedValues[storageKey];
    if (value === undefined) {
      delete snapshot[storageKey];
    } else {
      snapshot[storageKey] = value;
    }
  });

  const key = await importAesKey(dek);
  const storageKey = getSessionsVaultKey(generation);
  const encrypted = await encryptJson(snapshot, key, generation, storageKey);

  const latestMeta = await loadPasscodeMeta();
  if (
    !latestMeta
    || latestMeta.generation !== generation
    || latestMeta.isDisabling
  ) return false;

  await PASSCODE_IDB_STORE.set(storageKey, encrypted);
  if (currentDek === dek && currentDekGeneration === generation) {
    mergeEncryptedSessionStore(snapshot);
  }
  return true;
}

export async function restoreSessionsFromVault(expectedGeneration: string) {
  return navigator.locks.request(PASSCODE_SESSION_LOCK_NAME, () => (
    restoreSessionsFromVaultNow(expectedGeneration)
  ));
}

async function restoreSessionsFromVaultNow(expectedGeneration: string) {
  const snapshot = await decryptSessionsVault();
  const meta = await loadPasscodeMeta();
  if (meta?.generation !== expectedGeneration || currentDekGeneration !== expectedGeneration) {
    throw new PasscodeDataCorruptedError('[passcode] Passcode changed while restoring sessions');
  }

  mergeEncryptedSessionStore(snapshot);
  clearPersistentSessionValues(getSessionStorageKeys());
}

export async function restoreMissingSessionsFromVault() {
  if (isEncryptedSessionStoreHydrated()) return;

  const generation = currentDekGeneration;
  if (!generation) return;
  await restoreSessionsFromVault(generation);
}

export async function restoreSessionsToPersistentStorage(expectedGeneration: string) {
  await restoreSessionsFromVault(expectedGeneration);
  disableEncryptedSessionStore(getSessionStorageKeys());
}

export async function writeGlobalsVaultForSlot(slot: number | undefined, globalJson: string) {
  const dek = currentDek;
  const generation = currentDekGeneration;
  if (!dek || !generation) return;

  await navigator.locks.request(PASSCODE_GLOBALS_LOCK_NAME, () => (
    writeGlobalsVaultForSlotNow(slot, globalJson, dek, generation)
  ));
}

export async function removeGlobalsVaultForSlot(slot: number | undefined) {
  await navigator.locks.request(PASSCODE_GLOBALS_LOCK_NAME, async () => {
    const meta = await loadPasscodeMeta();
    if (!meta) return;

    await PASSCODE_IDB_STORE.del(getGlobalsVaultKey(meta.generation, slot));
  });
}

async function writeGlobalsVaultForSlotNow(
  slot: number | undefined,
  globalJson: string,
  dek: ArrayBuffer,
  generation: string,
) {
  const meta = await loadPasscodeMeta();
  if (!meta || meta.generation !== generation) return;

  const key = await importAesKey(dek);
  const storageKey = getGlobalsVaultKey(generation, slot);
  const encrypted = await encryptText(globalJson, key, generation, storageKey);

  await PASSCODE_IDB_STORE.set(storageKey, encrypted);
}

export async function readGlobalsVaultForSlot(slot: number | undefined) {
  const { dek, generation } = await loadCurrentDekContext();

  const storageKey = getGlobalsVaultKey(generation, slot);
  const stored = await PASSCODE_IDB_STORE.get<ArrayBuffer>(storageKey);
  if (!stored) return undefined;

  try {
    const key = await importAesKey(dek);
    const decrypted = await decryptVaultData(stored, key, generation, storageKey);
    const globalJson = new TextDecoder().decode(decrypted);
    JSON.parse(globalJson);
    return globalJson;
  } catch (err) {
    return undefined;
  }
}

export async function writeWallpaperVaultBlob(slug: string, blob: Blob) {
  const { dek, generation, meta } = await loadCurrentDekContext();
  if (meta.isLocked || meta.isDisabling) {
    throw new PasscodeDataCorruptedError('[passcode] Wallpaper vault is not writable');
  }

  const key = await importAesKey(dek);
  const storageKey = getWallpaperVaultKey(generation, slug);
  const data = await encryptVaultData(await encodeWallpaperBlob(blob), key, generation, storageKey);

  await PASSCODE_IDB_STORE.set(storageKey, data);
}

export async function readWallpaperVaultBlob(slug: string) {
  if (!currentDek || !currentDekGeneration) return undefined;

  const { dek, generation, meta } = await loadCurrentDekContext();
  if (meta.isLocked) return undefined;

  const storageKey = getWallpaperVaultKey(generation, slug);
  const data = await PASSCODE_IDB_STORE.get<ArrayBuffer>(storageKey);
  if (!data) return undefined;

  try {
    const key = await importAesKey(dek);
    return decodeWallpaperBlob(await decryptVaultData(data, key, generation, storageKey));
  } catch (err) {
    throw new PasscodeDataCorruptedError('[passcode] Failed to restore wallpaper vault');
  }
}

export async function readWallpaperVaultBlobs() {
  const context = await loadCurrentDekContext();
  const { meta } = context;
  if (meta.isLocked) {
    throw new PasscodeDataCorruptedError('[passcode] Wallpaper vault is locked');
  }
  return readWallpaperBlobs(context);
}

export async function removeWallpaperVaultBlob(slug: string) {
  const meta = await loadPasscodeMeta();
  if (!meta) return;

  await PASSCODE_IDB_STORE.del(getWallpaperVaultKey(meta.generation, slug));
}

export async function clearWallpaperVaultBlobs() {
  const storageKeys = await getWallpaperVaultKeys();
  if (!storageKeys.length) return;

  await PASSCODE_IDB_STORE.delMany(storageKeys);
}

// Keyed by address, the current wallet and the saved ones alike; only the current address counts as the local key
export async function writeWalletVaultSecret(slot: number | undefined, secret: ArrayBuffer, address: string) {
  await requestPasscodeStateLock(async () => {
    const { dek, generation, meta } = await loadCurrentDekContext();

    if (meta.isLocked || meta.isDisabling) {
      throw new PasscodeDataCorruptedError('[passcode] Wallet vault is not writable');
    }

    const key = await importAesKey(dek);
    const storageKey = getWalletVaultKey(generation, slot, address);
    await PASSCODE_IDB_STORE.set(storageKey, await encryptVaultData(secret, key, generation, storageKey));
  });
}

export async function readWalletVaultSecret(slot: number | undefined, address: string) {
  if (!currentDek || !currentDekGeneration) return undefined;

  const { dek, generation, meta } = await loadCurrentDekContext();
  if (meta.isLocked) return undefined;

  const storageKey = getWalletVaultKey(generation, slot, address);
  const data = await PASSCODE_IDB_STORE.get<ArrayBuffer>(storageKey);
  if (!data) return undefined;

  const key = await importAesKey(dek);

  return decryptVaultData(data, key, generation, storageKey);
}

export async function hasWalletVaultSecret(slot: number | undefined, address: string) {
  const meta = await loadPasscodeMeta();
  if (!meta) return false;

  return Boolean(await PASSCODE_IDB_STORE.get(getWalletVaultKey(meta.generation, slot, address)));
}

export async function listWalletVaultSecrets(slot: number | undefined) {
  const meta = await loadPasscodeMeta();
  if (!meta) return [];

  const prefix = getWalletVaultKey(meta.generation, slot, '');

  return (await getWalletVaultKeys(meta.generation))
    .filter((storageKey) => storageKey.startsWith(prefix))
    .map((storageKey) => storageKey.slice(prefix.length));
}

export async function hasOtherSlotWalletVaultSecrets(slot: number | undefined) {
  const meta = await loadPasscodeMeta();
  if (!meta) return false;

  const ownPrefix = getWalletVaultKey(meta.generation, slot, '');

  return (await getWalletVaultKeys(meta.generation)).some((storageKey) => !storageKey.startsWith(ownPrefix));
}

export async function removeWalletVaultSecret(slot: number | undefined, address: string) {
  await requestPasscodeStateLock(async () => {
    const meta = await loadPasscodeMeta();
    if (!meta) return;

    await PASSCODE_IDB_STORE.del(getWalletVaultKey(meta.generation, slot, address));
  });
}

export async function removeWalletVaultSecrets(slot: number | undefined) {
  await requestPasscodeStateLock(() => removeWalletVaultSecretsNow(slot));
}

// For a caller already holding the passcode state lock, which is not reentrant
export async function removeWalletVaultSecretsNow(slot: number | undefined) {
  const meta = await loadPasscodeMeta();
  if (!meta) return;

  const prefix = getWalletVaultKey(meta.generation, slot, '');
  const storageKeys = (await getWalletVaultKeys(meta.generation))
    .filter((storageKey) => storageKey.startsWith(prefix));

  await PASSCODE_IDB_STORE.delMany(storageKeys);
}

export async function clearPasscodeStore() {
  await requestPasscodeStateLock(async () => {
    await PASSCODE_IDB_STORE.clear();
    forgetDek();
    resetSessionStore();
  });
}

export async function hasLegacyEncryptedSession() {
  return Boolean(await PASSCODE_IDB_STORE.get(LEGACY_SESSION_KEY));
}

export async function decryptLegacySession(passcode: string) {
  const passcodeHash = await legacySha256(passcode);

  const [sessionEncrypted, globalEncrypted, sharedStateEncrypted] = await Promise.all([
    PASSCODE_IDB_STORE.get<number[]>(LEGACY_SESSION_KEY),
    PASSCODE_IDB_STORE.get<number[]>(LEGACY_GLOBAL_KEY),
    PASSCODE_IDB_STORE.get<number[]>(LEGACY_SHARED_STATE_KEY),
  ]);

  if (!sessionEncrypted || !globalEncrypted) {
    throw new PasscodeDataCorruptedError('[passcode] Missing legacy encrypted fields');
  }

  const key = await importAesKey(passcodeHash);

  let sessionJson: string;
  let globalJson: string;
  try {
    const [sessionBuffer, globalBuffer] = await Promise.all([
      aesDecrypt(toArrayBuffer(sessionEncrypted), key),
      aesDecrypt(toArrayBuffer(globalEncrypted), key),
    ]);
    const sharedStateBuffer = sharedStateEncrypted
      ? await aesDecrypt(toArrayBuffer(sharedStateEncrypted), key).catch(() => undefined) : undefined;
    sessionJson = new TextDecoder().decode(sessionBuffer);
    globalJson = new TextDecoder().decode(globalBuffer);
    const sharedStateJson = sharedStateBuffer ? new TextDecoder().decode(sharedStateBuffer) : undefined;
    return { sessionJson, globalJson, sharedStateJson };
  } catch (err) {
    throw new InvalidPasscodeError('[passcode] Invalid legacy passcode');
  }
}

export function clearLegacyEncryptedSession() {
  return PASSCODE_IDB_STORE.delMany([LEGACY_SESSION_KEY, LEGACY_GLOBAL_KEY, LEGACY_SHARED_STATE_KEY]);
}

export async function clearLegacyEncryptedSessionIfAllowed() {
  if (!SHOULD_DELETE_LEGACY_PASSCODE_DATA) return;

  await clearLegacyEncryptedSession();
}

async function decryptSessionsVault() {
  const { dek, generation } = await loadCurrentDekContext();

  return decryptSessionsVaultWith(dek, generation);
}

async function decryptSessionsVaultWith(dek: ArrayBuffer, generation: string) {
  const storageKey = getSessionsVaultKey(generation);
  const stored = await PASSCODE_IDB_STORE.get<ArrayBuffer>(storageKey);
  if (!stored) {
    throw new PasscodeDataCorruptedError('[passcode] Missing sessions vault');
  }

  try {
    const key = await importAesKey(dek);
    const decrypted = await decryptVaultData(stored, key, generation, storageKey);
    const snapshot = JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
    if (
      !snapshot
      || typeof snapshot !== 'object'
      || Array.isArray(snapshot)
      || Object.values(snapshot).some((value) => typeof value !== 'string')
    ) throw new Error();
    return snapshot as Record<string, string>;
  } catch (err) {
    throw new PasscodeDataCorruptedError('[passcode] Failed to restore sessions vault');
  }
}

async function loadCurrentDekContext() {
  const dek = currentDek;
  const generation = currentDekGeneration;
  if (!dek || !generation) {
    throw new PasscodeDataCorruptedError('[passcode] Missing current key');
  }

  const meta = await loadPasscodeMeta();
  if (meta?.generation !== generation || meta.version !== META_VERSION) {
    throw new PasscodeDataCorruptedError('[passcode] Stale current key');
  }

  return { dek, generation, meta };
}

async function unwrapDek(wrappedDek: number[], kek: CryptoKey, expectedMeta: PasscodeMeta, errorMessage: string) {
  let dek: ArrayBuffer;
  try {
    dek = await decryptVaultData(toArrayBuffer(wrappedDek), kek, expectedMeta.generation, PASSCODE_META_KEY);
  } catch (err) {
    throw new InvalidPasscodeError(errorMessage);
  }

  const meta = await loadPasscodeMeta();
  if (
    meta?.generation !== expectedMeta.generation
    || meta.lockEpoch !== expectedMeta.lockEpoch
    || meta.version !== META_VERSION
  ) {
    throw new Error('[passcode] Passcode state changed while unlocking');
  }

  return dek;
}

export function collectSessionStorageSnapshot() {
  return collectSessionValues(getSessionStorageKeys());
}

function getSessionStorageKeys() {
  const slotKeys = [...getSessionValueKeys(), ...Object.keys(localStorage)]
    .filter((key) => {
      if (!key.startsWith(SESSION_ACCOUNT_PREFIX)) return false;
      const slot = Number(key.slice(SESSION_ACCOUNT_PREFIX.length));
      return slot > 0 && Number.isInteger(slot);
    });
  return [
    ...new Set(slotKeys),
    SESSION_LEGACY_USER_KEY,
    'dc',
    ...DC_IDS.map((dcId) => `dc${dcId}_auth_key`),
    ...DC_IDS.map((dcId) => `dc${dcId}_hash`),
    ...DC_IDS.map((dcId) => `dc${dcId}_server_salt`),
  ];
}

function createGeneration() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
}

async function createPasscodeContext(passcode: string, lockEpoch: number, autolockDuration?: number) {
  const dek = crypto.getRandomValues(new Uint8Array(DEK_LENGTH)).buffer;
  const generation = createGeneration();
  const kdfSalt = crypto.getRandomValues(new Uint8Array(KDF_SALT_LENGTH));
  const kek = await deriveKekFromPasscode(passcode, kdfSalt, KDF_ITERATIONS);
  const wrappedDek = await encryptVaultData(dek, kek, generation, PASSCODE_META_KEY);
  const meta: PasscodeMeta = {
    version: META_VERSION,
    generation,
    kdfSalt: Array.from(kdfSalt),
    kdfIterations: KDF_ITERATIONS,
    wrappedDek: Array.from(new Uint8Array(wrappedDek)),
    lockEpoch,
    isLocked: false,
    autolockDuration,
  };
  return { dek, generation, meta };
}

function getSessionsVaultKey(generation: string) {
  return `${SESSIONS_VAULT_KEY_PREFIX}${generation}`;
}

function getGlobalsVaultKey(generation: string, slot: number | undefined) {
  return `${getGlobalsVaultKeyPrefix(generation)}${slot || 1}`;
}

function getGlobalsVaultKeyPrefix(generation?: string) {
  return generation ? `${GLOBALS_VAULT_KEY_PREFIX}${generation}_` : GLOBALS_VAULT_KEY_PREFIX;
}

function getWallpaperVaultKeyPrefix(generation?: string) {
  return generation ? `${WALLPAPERS_VAULT_KEY_PREFIX}${generation}_` : WALLPAPERS_VAULT_KEY_PREFIX;
}

function getWallpaperVaultKey(generation: string, slug: string) {
  return `${getWallpaperVaultKeyPrefix(generation)}${slug}`;
}

async function getWallpaperVaultKeys(generation?: string) {
  return getVaultKeys(getWallpaperVaultKeyPrefix(generation));
}

function getWalletVaultKeyPrefix(generation?: string) {
  return generation ? `${WALLET_VAULT_KEY_PREFIX}${generation}_` : WALLET_VAULT_KEY_PREFIX;
}

// An empty `address` yields the prefix all of a slot's wallets share
function getWalletVaultKey(generation: string, slot: number | undefined, address: string) {
  return `${getWalletVaultKeyPrefix(generation)}${slot || 1}#${address}`;
}

async function getWalletVaultKeys(generation?: string) {
  return getVaultKeys(getWalletVaultKeyPrefix(generation));
}

async function getGlobalVaultKeys(generation?: string) {
  return getVaultKeys(getGlobalsVaultKeyPrefix(generation));
}

async function getVaultKeys(keyPrefix: string) {
  const storageKeys = await PASSCODE_IDB_STORE.keys();
  return storageKeys.filter(
    (storageKey): storageKey is string => typeof storageKey === 'string' && storageKey.startsWith(keyPrefix),
  );
}

async function readGlobalSnapshots({ dek, generation }: Awaited<ReturnType<typeof loadCurrentDekContext>>) {
  const key = await importAesKey(dek);
  const snapshots: GlobalSnapshot[] = [];
  const storageKeys = await getGlobalVaultKeys(generation);
  const entries = await PASSCODE_IDB_STORE.getMany<ArrayBuffer>(storageKeys);

  for (let index = 0; index < storageKeys.length; index++) {
    const storageKey = storageKeys[index];
    const stored = entries[index];
    if (!stored) continue;

    try {
      const decrypted = await decryptVaultData(stored, key, generation, storageKey);
      const slot = Number(storageKey.slice(getGlobalsVaultKeyPrefix(generation).length));
      if (!slot) throw new Error();
      const globalJson = new TextDecoder().decode(decrypted);
      JSON.parse(globalJson);
      snapshots.push({ slot, globalJson });
    } catch (err) {
      // Corrupted global caches are recoverable and are dropped
    }
  }

  return snapshots;
}

async function readWallpaperBlobs({ dek, generation }: Awaited<ReturnType<typeof loadCurrentDekContext>>) {
  const storageKeys = await getWallpaperVaultKeys(generation);
  const entries = await PASSCODE_IDB_STORE.getMany<ArrayBuffer>(storageKeys);
  const key = await importAesKey(dek);
  const blobs: Array<[string, Blob]> = [];

  for (let index = 0; index < storageKeys.length; index++) {
    const entry = entries[index];
    if (!entry) continue;

    try {
      const storageKey = storageKeys[index];
      const slug = storageKey.slice(getWallpaperVaultKeyPrefix(generation).length);
      const decrypted = await decryptVaultData(entry, key, generation, storageKey);
      blobs.push([slug, decodeWallpaperBlob(decrypted)]);
    } catch (err) {
      // Corrupted wallpapers are recoverable and are dropped
    }
  }

  return blobs;
}

async function readWalletSecrets({ dek, generation }: Awaited<ReturnType<typeof loadCurrentDekContext>>) {
  const storageKeys = await getWalletVaultKeys(generation);
  const entries = await PASSCODE_IDB_STORE.getMany<ArrayBuffer>(storageKeys);
  const key = await importAesKey(dek);
  const secrets: Array<[string, ArrayBuffer]> = [];

  for (let index = 0; index < storageKeys.length; index++) {
    const entry = entries[index];
    if (!entry) continue;

    try {
      const storageKey = storageKeys[index];
      const walletKey = storageKey.slice(getWalletVaultKeyPrefix(generation).length);
      secrets.push([walletKey, await decryptVaultData(entry, key, generation, storageKey)]);
    } catch (err) {
      // A secret that fails to decrypt is corrupted beyond recovery and is dropped with the old generation
    }
  }

  return secrets;
}

async function encryptVaultEntries(
  dek: ArrayBuffer,
  generation: string,
  sessionSnapshot: Record<string, string>,
  globalSnapshots: GlobalSnapshot[],
  wallpaperBlobs: Array<[string, Blob]>,
  walletSecrets: Array<[string, ArrayBuffer]>,
) {
  const key = await importAesKey(dek);
  const sessionsStorageKey = getSessionsVaultKey(generation);
  const entries: Array<[string, unknown]> = [[
    sessionsStorageKey,
    await encryptJson(sessionSnapshot, key, generation, sessionsStorageKey),
  ]];

  for (const { slot, globalJson } of globalSnapshots) {
    const storageKey = getGlobalsVaultKey(generation, slot);
    entries.push([
      storageKey,
      await encryptText(globalJson, key, generation, storageKey),
    ]);
  }

  for (const [slug, blob] of wallpaperBlobs) {
    const storageKey = getWallpaperVaultKey(generation, slug);
    entries.push([
      storageKey,
      await encryptVaultData(await encodeWallpaperBlob(blob), key, generation, storageKey),
    ]);
  }

  for (const [walletKey, secret] of walletSecrets) {
    const storageKey = `${getWalletVaultKeyPrefix(generation)}${walletKey}`;
    entries.push([storageKey, await encryptVaultData(secret, key, generation, storageKey)]);
  }

  return entries;
}

async function removeVaultGeneration(generation: string) {
  try {
    const wallpaperVaultKeys = await getWallpaperVaultKeys(generation);
    const globalVaultKeys = await getGlobalVaultKeys(generation);
    const walletVaultKeys = await getWalletVaultKeys(generation);

    await PASSCODE_IDB_STORE.delMany([
      getSessionsVaultKey(generation),
      ...globalVaultKeys,
      ...wallpaperVaultKeys,
      ...walletVaultKeys,
    ]);
  } catch {
    // Old-generation cleanup is best-effort
  }
}

async function encodeWallpaperBlob(blob: Blob) {
  const type = new TextEncoder().encode(blob.type);
  const blobData = new Uint8Array(await blob.arrayBuffer());
  const data = new Uint8Array(WALLPAPER_TYPE_LENGTH_BYTES + type.length + blobData.length);
  new DataView(data.buffer).setUint32(0, type.length);
  data.set(type, WALLPAPER_TYPE_LENGTH_BYTES);
  data.set(blobData, WALLPAPER_TYPE_LENGTH_BYTES + type.length);
  return data.buffer;
}

function decodeWallpaperBlob(data: ArrayBuffer) {
  if (data.byteLength < WALLPAPER_TYPE_LENGTH_BYTES) throw new Error();

  const typeLength = new DataView(data).getUint32(0);
  const blobOffset = WALLPAPER_TYPE_LENGTH_BYTES + typeLength;
  if (blobOffset > data.byteLength) throw new Error();

  const type = new TextDecoder().decode(new Uint8Array(data, WALLPAPER_TYPE_LENGTH_BYTES, typeLength));
  return new Blob([data.slice(blobOffset)], { type });
}

async function encryptJson(value: unknown, key: CryptoKey, generation: string, storageKey: string) {
  return encryptText(JSON.stringify(value), key, generation, storageKey);
}

function encryptText(value: string, key: CryptoKey, generation: string, storageKey: string) {
  return encryptVaultData(new TextEncoder().encode(value).buffer, key, generation, storageKey);
}

function encryptVaultData(data: ArrayBuffer, key: CryptoKey, generation: string, storageKey: string) {
  return aesEncrypt(data, key, buildVaultAad(generation, storageKey));
}

function decryptVaultData(data: ArrayBuffer, key: CryptoKey, generation: string, storageKey: string) {
  return aesDecrypt(data, key, buildVaultAad(generation, storageKey));
}

function buildVaultAad(generation: string, storageKey: string) {
  return new TextEncoder().encode(`${META_VERSION}:${generation}:${storageKey}`);
}

function deriveKekFromPasscode(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveKey'])
    .then((keyMaterial) => crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ));
}

function importAesKey(rawKey: ArrayBuffer) {
  return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function legacySha256(plaintext: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${plaintext}${LEGACY_SALT}`));
}

function toArrayBuffer(data: number[]) {
  return new Uint8Array(data).buffer;
}

async function aesEncrypt(data: ArrayBuffer, key: CryptoKey, additionalData?: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ctBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, data);
  const ct = new Uint8Array(ctBuffer);
  const result = new Uint8Array(IV_LENGTH + ct.length);
  result.set(iv, 0);
  result.set(ct, IV_LENGTH);
  return result.buffer;
}

function aesDecrypt(data: ArrayBuffer, key: CryptoKey, additionalData?: Uint8Array<ArrayBuffer>) {
  const dataArray = new Uint8Array(data);
  const iv = dataArray.slice(0, IV_LENGTH);
  const ct = dataArray.slice(IV_LENGTH);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, key, ct);
}
