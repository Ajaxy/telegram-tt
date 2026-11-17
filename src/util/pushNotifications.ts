import { addCallback } from '../lib/teact/teactn';
import { getActions, getGlobal } from '../global';

import type { ApiAccountConnection } from '../api/types';
import type { GlobalState } from '../global/types';
import type { SharedSessionData } from '../types';
import type { PushAccount, PushNotification, PushRetry, PushState } from './push';

import { DC_IDS, SESSION_ACCOUNT_PREFIX, VAPID_SERVER_KEY } from '../config';
import { loadCachedGlobalForSlot } from '../global/cache';
import { selectChat, selectTabState } from '../global/selectors';
import { selectSharedSettings } from '../global/selectors/sharedState';
import { callApi } from '../api/gramjs';
import { IS_TAURI } from './browser/globalEnvironment';
import { PUSH_IDB_STORE } from './browser/idb';
import { IS_TOUCH_ENV, PLATFORM_ENV } from './browser/windowEnvironment';
import { base64UrlToBuffer, bufferToBase64Url } from './encoding/base64';
import { buffersEqual } from './encoding/buffer';
import { getDirtySessionKeys, isSessionStoreLocked, writeSessionValue } from './passcode/sessionStore';
import { areArraysShallowEqual } from './areShallowEqual';
import { getCurrentTabId, isCurrentTabMaster } from './establishMultitabRole';
import { getTranslationFn } from './localization';
import { ACCOUNT_SLOT, getAccountSlots, loadSlotSession, updateSessionStorage } from './multiaccount';
import { parseJsonWithBigInt } from './numbers';
import { getDek, getDekGeneration, loadPasscodeMeta, readGlobalsVaultForSlot } from './passcode';
import {
  getPushKeyId, getPushTarget, hashPushValue, PUSH_CLICK_PREFIX, PUSH_CLICK_TIMEOUT_MS, PUSH_DISPLAY_LOCK,
  PUSH_KEY_LENGTH, PUSH_REGISTRATION_LOCK, PUSH_STATE_KEY, readPushState,
} from './push';
import { pause } from './schedulers';

const REGISTRATION_INTERVAL_MS = 12 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 1000;
const MAX_RETRY_INTERVAL_MS = 15 * 60 * 1000;
const SUBSCRIPTION_TIMEOUT_MS = 10000;
const CURRENT_SLOT = ACCOUNT_SLOT || 1;

type PushRegistration = {
  account: PushAccount;
  userId: string;
  secret: Uint8Array<ArrayBuffer>;
  connection?: ApiAccountConnection;
};

let reconcilePromise: Promise<boolean> | undefined;
let pendingClick: PushNotification | undefined;
let lastHandledClickId: string | undefined;
let isOpeningClick = false;
let hasInitialized = false;
let isSubscriptionFailed = false;

export function checkIfPushSubscriptionFailed() {
  return isSubscriptionFailed;
}

export function reconcilePushNotifications(): Promise<boolean> {
  if (!canPreparePush()) return Promise.resolve(false);

  return reconcilePromise ||= navigator.locks.request(PUSH_REGISTRATION_LOCK, reconcilePushRegistrations)
    .catch(async () => {
      const worker = await navigator.serviceWorker.getRegistration();
      // Without a subscription nothing can deliver plaintext, and pausing would close every notification
      if (!await worker?.pushManager?.getSubscription()) return false;

      const state = await readPushState();
      const hasPlaintextRegistration = state && Object.values(state.accounts).some((account) => (
        account.isEnabled && account.shouldHidePreviews && account.registration && !account.registration.keyId
      ));
      const hasUntrackedPrivateAccount = !state && Boolean(await loadPasscodeMeta())
        && !getGlobal().settings.byKey.shouldShowPushPreviewsWhenLocked;

      if (state?.isPaused || hasPlaintextRegistration || hasUntrackedPrivateAccount) {
        await suspendPushForPasscode().catch(() => undefined);
      }

      return false;
    })
    .finally(() => {
      reconcilePromise = undefined;
    });
}

export async function refreshPushNotificationState() {
  if (!canPreparePush()) return;

  await navigator.locks.request(PUSH_REGISTRATION_LOCK, preparePushState);
}

async function reconcilePushRegistrations() {
  const prepared = await preparePushState();

  if (!prepared || !canManagePush()) return false;

  const { registrations, state, generation } = prepared;

  const serviceWorker = await navigator.serviceWorker.getRegistration();

  if (!serviceWorker?.active) return false;

  let subscription = await serviceWorker.pushManager.getSubscription() || undefined;
  const enabled = registrations.filter(({ account }) => account.isEnabled);

  if (!enabled.length) {
    const isSuccessful = !subscription || await registerPushAccounts(registrations, state, subscription);

    if (isSuccessful) {
      await subscription?.unsubscribe();

      Object.values(state.accounts).forEach((account) => {
        account.registration = undefined;
      });
    }

    state.isPaused = undefined;
    state.subscriptionRetry = undefined;

    await writePushState(state, state.revision);

    return isSuccessful;
  }

  const applicationServerKey = base64UrlToBuffer(VAPID_SERVER_KEY!);
  const subscribedKey = subscription?.options.applicationServerKey;
  const hasUnconfirmedEncryption = enabled.some(({ account }) => (
    account.shouldHidePreviews && !account.registration && !account.registrationRetry
  ));

  if (subscription && (state.isPaused || hasUnconfirmedEncryption || !subscribedKey
    || !buffersEqual(new Uint8Array(subscribedKey), applicationServerKey))) {
    await subscription.unsubscribe();

    if (await serviceWorker.pushManager.getSubscription()) throw new Error('Unable to replace push subscription');

    subscription = undefined;
  }

  if (!subscription) {
    if (state.subscriptionRetry && Date.now() < state.subscriptionRetry.retryAt) return false;

    Object.values(state.accounts).forEach((account) => {
      account.registration = undefined;
    });

    if (!await writePushState(state, state.revision)) return false;

    try {
      subscription = await Promise.race([
        serviceWorker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }),
        pause(SUBSCRIPTION_TIMEOUT_MS).then(() => undefined),
      ]);

      if (!subscription) throw new Error('Push subscription timed out');

      state.subscriptionRetry = undefined;

      // A pending retry keeps an interrupted registration from rotating the fresh endpoint again
      const tokenHash = await hashPushValue(getPushDeviceToken(subscription));
      enabled.forEach(({ account }) => {
        if (account.shouldHidePreviews) account.registrationRetry = buildPendingRetry(account.keyId, tokenHash);
      });

      if (!await writePushState(state, state.revision)) return false;
    } catch (err) {
      state.subscriptionRetry = getPushRetry(state.subscriptionRetry);
      await writePushState(state, state.revision);

      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotSupportedError')) {
        // The push service rejects this browser, so offline notifications are reported as unsupported
        isSubscriptionFailed = true;
        getActions().updateWebNotificationSettings({ hasPushNotifications: false });
      }

      throw err;
    }
  }

  const isSuccessful = await registerPushAccounts(registrations, state, subscription);

  // Locking keeps the passcode, so the results stay valid and must clear the pause before pushes arrive locked
  if (generation !== getDekGeneration() && !isSessionStoreLocked()) return false;

  if (isSuccessful) state.isPaused = undefined;

  if (!await writePushState(state, state.revision)) return false;

  notifyPushClientReady();

  return isSuccessful;
}

async function preparePushState() {
  if (!canPreparePush()) return undefined;

  const generation = getDekGeneration();
  const meta = await loadPasscodeMeta();

  if (meta && (!getDek() || meta.isLocked || meta.isDisabling)) return undefined;

  const previous = await readPushState();
  const registrations = await preparePushRegistrations(previous, Boolean(meta));

  if (!registrations || !canPreparePush() || generation !== getDekGeneration()) return undefined;

  const state: PushState = {
    accounts: Object.fromEntries(registrations.map(({ account }) => [account.slot, account])),
    hiddenMessage: getTranslationFn()('NotificationMessageTextHidden'),
    hasPasscode: Boolean(meta),
    revision: await hashPushValue(JSON.stringify([
      Boolean(meta), registrations.map(({ account }) => ({
        ...account, registration: undefined, registrationRetry: undefined,
      })),
    ])),
    isPaused: previous?.isPaused,
    subscriptionRetry: previous?.subscriptionRetry,
  };

  if (!await writePushState(state, previous?.revision)) return undefined;

  if (Object.values(state.accounts).some((account) => account.shouldHidePreviews
    && !previous?.accounts[account.slot]?.shouldHidePreviews)) {
    await clearPrivatePushNotifications();
  }

  notifyPushClientReady();

  return { registrations, state, generation };
}

async function preparePushRegistrations(previous: PushState | undefined, hasPasscode: boolean) {
  const registrations: PushRegistration[] = [];

  for (const slot of getAccountSlots()) {
    let session = loadSlotSession(slot);

    if (!session?.userId) continue;

    const userIdHash = await hashPushValue(session.userId);
    let key = session.pushKey ? base64UrlToBuffer(session.pushKey) : undefined;
    let keyId = key ? await getPushKeyId(key) : undefined;

    const previousAccount = previous?.accounts[slot];
    const oldAccount = previousAccount && (previousAccount.userHash === userIdHash
      || (keyId && previousAccount.userHash === keyId)) ? previousAccount : undefined;

    let settings = slot === CURRENT_SLOT ? getGlobal().settings.byKey : undefined;

    if (slot !== CURRENT_SLOT && !oldAccount) {
      const snapshot = hasPasscode
        ? parseJsonWithBigInt<Partial<GlobalState>>(await readGlobalsVaultForSlot(slot) || '{}')
        : await loadCachedGlobalForSlot(slot);

      settings = snapshot?.settings?.byKey;
    }

    const isEnabled = slot !== CURRENT_SLOT && oldAccount
      ? oldAccount.isEnabled
      : Boolean(settings?.hasWebNotifications && settings.hasPushNotifications);
    const shouldShowPreviewsWhenLocked = slot !== CURRENT_SLOT && oldAccount
      ? oldAccount.shouldShowPreviewsWhenLocked
      : Boolean(settings?.shouldShowPushPreviewsWhenLocked);
    const shouldHidePreviews = hasPasscode && !shouldShowPreviewsWhenLocked;

    const sessionKey = `${SESSION_ACCOUNT_PREFIX}${slot}`;

    if (shouldHidePreviews && (!session.pushKey || getDirtySessionKeys().includes(sessionKey))) {
      const pushKey = bufferToBase64Url(crypto.getRandomValues(new Uint8Array(PUSH_KEY_LENGTH)));

      await updateSessionStorage(() => {
        const latest = loadSlotSession(slot);

        if (!latest || latest.userId !== session?.userId || latest.pushKey) return;

        writeSessionValue(sessionKey, JSON.stringify({ ...latest, pushKey }));
      });

      if (getDirtySessionKeys().includes(sessionKey)) throw new Error('Unable to persist push key');

      session = loadSlotSession(slot);

      if (!session?.pushKey || !session.userId) return undefined;

      key = base64UrlToBuffer(session.pushKey);
      keyId = await getPushKeyId(key);
    }

    // An account that was unregistered cleanly, or is new to tracked state, has no plaintext registration to rotate away
    const isKnownUnregistered = oldAccount ? !oldAccount.isEnabled && !oldAccount.registration : Boolean(previous);

    const account: PushAccount = {
      slot,
      userHash: shouldHidePreviews ? keyId! : userIdHash,
      keyId,
      isTest: session.isTest,
      isEnabled,
      shouldHidePreviews,
      shouldShowPreviewsWhenLocked,
      registration: oldAccount?.registration,
      registrationRetry: oldAccount?.isEnabled === isEnabled ? oldAccount.registrationRetry
        : isEnabled && shouldHidePreviews && isKnownUnregistered ? buildPendingRetry(keyId) : undefined,
    };

    registrations.push({
      account,
      userId: session.userId,
      secret: shouldHidePreviews && isEnabled ? key! : new Uint8Array(),
      connection: slot !== CURRENT_SLOT ? buildPushAccountConnection(session) : undefined,
    });
  }

  const hasRoutingChange = registrations.some(({ account }) => (
    previous?.accounts[account.slot] && previous.accounts[account.slot].userHash !== account.userHash
  ));

  for (const { account, userId } of registrations) {
    const cached = account.registration;

    if (!cached) continue;

    const others = registrations.filter((item) => item.userId !== userId
      && Boolean(item.account.isTest) === Boolean(account.isTest));
    const legacyHash = await hashPushValue(others.map((item) => item.userId).sort().join(','));

    if (cached.accountsHash === legacyHash) {
      account.registration = {
        ...cached,
        accountsHash: await hashPushValue(others.map((item) => item.account.userHash).sort().join(',')),
      };
    } else if (hasRoutingChange) {
      account.registration = { ...cached, accountsHash: '' };
    }
  }

  return registrations;
}

function buildPushAccountConnection(session: SharedSessionData): ApiAccountConnection {
  const { language, shouldAllowHttpTransport, shouldForceHttpTransport } = selectSharedSettings(getGlobal());

  return {
    sessionData: {
      mainDcId: session.dcId,
      authKeyCreatedAt: session.authKeyCreatedAt,
      tempAuthKey: session.tempAuthKey,
      isTest: session.isTest,
      keys: Object.fromEntries(DC_IDS.flatMap((dcId) => {
        const authKey = session[`dc${dcId}_auth_key`];
        return authKey ? [[dcId, authKey]] : [];
      })),
    },
    platform: PLATFORM_ENV,
    langCode: language,
    shouldAllowHttpTransport,
    shouldForceHttpTransport,
  };
}

async function registerPushAccounts(
  registrations: PushRegistration[],
  state: PushState,
  subscription: PushSubscription,
) {
  const token = getPushDeviceToken(subscription);
  const tokenHash = await hashPushValue(token);

  let isSuccessful = true;
  state.isPaused = undefined;

  for (const registration of registrations) {
    const { account, userId, secret, connection } = registration;
    const stored = state.accounts[account.slot];

    const otherAccounts = registrations
      .filter((item) => item.userId !== userId && Boolean(item.account.isTest) === Boolean(account.isTest));
    const otherIds = otherAccounts.map((item) => item.userId);

    if (!stored.isEnabled) {
      if (stored.registration) {
        const retry = stored.registrationRetry;

        if (retry && Date.now() < retry.retryAt) {
          isSuccessful = false;

          continue;
        }

        if (!canManagePush()) return false;

        const result = await callApi('unregisterDevice', { token, otherIds, connection }).catch(() => undefined);

        if (result === true) {
          stored.registration = undefined;
          stored.registrationRetry = undefined;
        } else {
          isSuccessful = false;
          stored.registrationRetry = { ...getPushRetry(retry, result === false), tokenHash, accountsHash: '' };
        }
      }

      continue;
    }

    const keyId = secret.length ? stored.keyId : undefined;
    const accountsHash = await hashPushValue(otherAccounts.map((item) => item.account.userHash).sort().join(','));
    const cached = stored.registration;

    if (
      cached?.tokenHash === tokenHash
      && cached.keyId === keyId
      && cached.accountsHash === accountsHash
      && Date.now() - cached.subscribedAt < REGISTRATION_INTERVAL_MS
    ) {
      stored.registrationRetry = undefined;
      continue;
    }

    const retry = stored.registrationRetry;
    const hasSameRetry = retry?.tokenHash === tokenHash && retry.keyId === keyId && retry.accountsHash === accountsHash;

    if (hasSameRetry && Date.now() < retry.retryAt) {
      isSuccessful = false;

      continue;
    }

    if (!canManagePush()) return false;

    const result = await callApi('registerDevice', { token, otherIds, secret, connection }).catch(() => undefined);

    if (result !== true) {
      isSuccessful = false;
      stored.registrationRetry = {
        ...getPushRetry(hasSameRetry ? retry : undefined, result === false), tokenHash, keyId, accountsHash,
      };

      if (stored.shouldHidePreviews && cached?.tokenHash === tokenHash && !cached.keyId) {
        state.isPaused = true;

        Object.values(state.accounts).forEach((item) => {
          item.registration = undefined;
        });

        await writePushState(state, state.revision);
        await subscription.unsubscribe();

        break;
      }
    } else {
      stored.registration = { tokenHash, keyId, accountsHash, subscribedAt: Date.now() };
      stored.registrationRetry = undefined;
    }
  }

  return isSuccessful;
}

function getPushRetry(previous: PushRetry | undefined, isTerminated?: boolean): PushRetry {
  const attempts = (previous?.attempts || 0) + 1;

  return {
    attempts,
    // A terminated session never recovers; a new login replaces the account and its retry
    retryAt: isTerminated ? Infinity
      : Date.now() + Math.min(RETRY_INTERVAL_MS * 2 ** (attempts - 1), MAX_RETRY_INTERVAL_MS),
  };
}

function buildPendingRetry(keyId?: string, tokenHash = ''): PushAccount['registrationRetry'] {
  return {
    attempts: 0, retryAt: 0, tokenHash, keyId, accountsHash: '',
  };
}

function writePushState(state: PushState, expectedRevision: string | undefined) {
  return navigator.locks.request(PUSH_DISPLAY_LOCK, async () => {
    const previous = await readPushState();

    if (previous?.revision !== expectedRevision) return false;

    for (const account of Object.values(state.accounts)) {
      const oldAccount = previous?.accounts[account.slot];

      if (!oldAccount || oldAccount.userHash === account.userHash) continue;

      const worker = await navigator.serviceWorker.getRegistration();
      const notifications = await worker?.getNotifications?.();

      notifications?.forEach((notification) => {
        if (notification.data?.slot === account.slot && notification.data.userHash === oldAccount.userHash) {
          notification.close();
        }
      });

      const clickKey = `${PUSH_CLICK_PREFIX}${account.slot}`;
      const pending = await PUSH_IDB_STORE.get<PushNotification>(clickKey);

      if (pending?.p && pending.userHash === oldAccount.userHash
        && account.keyId && account.keyId === oldAccount.keyId) {
        await PUSH_IDB_STORE.set(clickKey, { ...pending, userHash: account.userHash });
      }
    }

    await PUSH_IDB_STORE.set(PUSH_STATE_KEY, state);

    return true;
  });
}

export async function suspendPushForPasscode(shouldHideCurrentAccount?: boolean) {
  if (!('serviceWorker' in navigator) || IS_TAURI) return;

  // Publish privacy before waiting for an in-flight network registration
  await pauseDisplay();
  await clearPrivatePushNotifications();

  await navigator.locks.request(PUSH_REGISTRATION_LOCK, async () => {
    await pauseDisplay();

    const worker = await navigator.serviceWorker.getRegistration();
    const subscription = await worker?.pushManager?.getSubscription();

    if (subscription && !await subscription.unsubscribe() && await worker?.pushManager?.getSubscription()) {
      throw new Error('Unable to pause push delivery');
    }
  });

  async function pauseDisplay() {
    await navigator.locks.request(PUSH_DISPLAY_LOCK, async () => {
      const state = await readPushState();
      const account = state?.accounts[CURRENT_SLOT];

      if (account && shouldHideCurrentAccount) {
        account.shouldShowPreviewsWhenLocked = false;
        account.shouldHidePreviews = true;
      }

      if (state) {
        await PUSH_IDB_STORE.set(PUSH_STATE_KEY, {
          ...state,
          hasPasscode: true,
          isPaused: true,
          revision: crypto.randomUUID(),
        } satisfies PushState);
      }

      const worker = await navigator.serviceWorker.getRegistration();
      const notifications = await worker?.getNotifications?.();

      notifications?.forEach((notification) => notification.close());
    });
  }
}

export async function clearPrivatePushNotifications() {
  if (!('serviceWorker' in navigator) || IS_TAURI) return;

  await navigator.locks.request(PUSH_DISPLAY_LOCK, async () => {
    const meta = await loadPasscodeMeta();
    const state = await readPushState();

    if (!meta && !state?.hasPasscode) return;

    const worker = await navigator.serviceWorker.getRegistration();
    const notifications = await worker?.getNotifications?.();

    notifications?.forEach((notification) => {
      const data: PushNotification = notification.data;

      if (!state?.accounts[data?.slot]?.shouldShowPreviewsWhenLocked && !data?.isGeneric) notification.close();
    });

    const entries = await PUSH_IDB_STORE.entries();

    await Promise.all(entries.flatMap(([key, value]) => {
      const data = value as PushNotification | undefined;

      return typeof key === 'string' && key.startsWith(PUSH_CLICK_PREFIX) && data && !data.p
        && !state?.accounts[data.slot]?.shouldShowPreviewsWhenLocked ? [PUSH_IDB_STORE.del(key)] : [];
    }));
  });
}

export async function unregisterPushAccount(shouldRemoveAll?: boolean) {
  if (!('serviceWorker' in navigator) || IS_TAURI) return;

  await navigator.locks.request(PUSH_REGISTRATION_LOCK, async () => {
    const worker = await navigator.serviceWorker.getRegistration();
    const subscription = await worker?.pushManager?.getSubscription();

    const state = await navigator.locks.request(PUSH_DISPLAY_LOCK, async () => {
      const latest = await readPushState();

      if (latest) {
        Object.values(latest.accounts).forEach((account) => {
          if (shouldRemoveAll || account.slot === CURRENT_SLOT) account.isEnabled = false;
        });
        if (!loadSlotSession(CURRENT_SLOT)) delete latest.accounts[CURRENT_SLOT];

        latest.revision = crypto.randomUUID();
        await PUSH_IDB_STORE.set(PUSH_STATE_KEY, latest);
      }

      await PUSH_IDB_STORE.del(`${PUSH_CLICK_PREFIX}${CURRENT_SLOT}`);

      const notifications = await worker?.getNotifications?.();

      notifications?.forEach((notification) => {
        if (shouldRemoveAll || notification.data?.slot === CURRENT_SLOT) notification.close();
      });

      return latest;
    });

    for (const account of Object.values(state?.accounts || {})) {
      if ((!shouldRemoveAll && account.slot !== CURRENT_SLOT)
        || !account.registration || !subscription || !canManagePush()) continue;

      const slotSession = loadSlotSession(account.slot);

      if (account.slot !== CURRENT_SLOT && !slotSession) continue;

      const otherIds = getAccountSlots()
        .filter((slot) => slot !== account.slot)
        .map(loadSlotSession)
        .filter((session) => session?.isTest === account.isTest)
        .map((session) => session?.userId)
        .filter(Boolean);

      const result = await callApi('unregisterDevice', {
        token: getPushDeviceToken(subscription), otherIds,
        connection: account.slot !== CURRENT_SLOT ? buildPushAccountConnection(slotSession!) : undefined,
      }).catch(() => undefined);

      if (result === true) {
        account.registration = undefined;

        await PUSH_IDB_STORE.update<PushState | undefined>(PUSH_STATE_KEY, (latest) => {
          const currentAccount = latest?.accounts[account.slot];

          if (currentAccount?.userHash === account.userHash) currentAccount.registration = undefined;

          return latest;
        });
      }
    }

    if (shouldRemoveAll || !Object.values(state?.accounts || {}).some((item) => item.isEnabled || item.registration)) {
      await subscription?.unsubscribe();
    }

    if (shouldRemoveAll) {
      await navigator.locks.request(PUSH_DISPLAY_LOCK, () => PUSH_IDB_STORE.clear());
    }
  });
}

function getPushDeviceToken(subscription: PushSubscription) {
  const data = subscription.toJSON();

  return JSON.stringify({ endpoint: data.endpoint, keys: data.keys, vapid: true });
}

export async function getPushIdentity() {
  const userId = getGlobal().currentUserId;

  if (!userId) return undefined;

  const state = await readPushState();

  // The worker drops notifications for accounts missing from push state
  if (!state?.accounts[CURRENT_SLOT]) return undefined;

  const meta = await loadPasscodeMeta();

  const account = state.accounts[CURRENT_SLOT];
  let userHash: string;

  if (account.shouldHidePreviews) {
    const session = loadSlotSession(CURRENT_SLOT);

    if (!session?.pushKey || session.userId !== userId) return undefined;

    userHash = await getPushKeyId(base64UrlToBuffer(session.pushKey));
  } else {
    userHash = await hashPushValue(userId);
  }

  return {
    slot: CURRENT_SLOT,
    userHash,
    revision: state.revision,
    lockEpoch: meta?.lockEpoch,
    isPushEncrypted: Boolean(account.isEnabled && account.shouldHidePreviews && account.registration?.keyId),
  };
}

export function initPushNotifications() {
  if (hasInitialized || !('serviceWorker' in navigator) || IS_TAURI) return;

  hasInitialized = true;

  let previousSignature: unknown[] = [];
  let wasReady = false;

  addCallback(() => {
    const global = getGlobal();

    if (!global.isInited) return;

    const settings = global.settings.byKey;

    if (global.passcode.isScreenLocked && !settings.shouldShowPushPreviewsWhenLocked && !pendingClick?.p) {
      pendingClick = undefined;
    }

    const signature = [
      global.currentUserId,
      global.connectionState,
      isCurrentTabMaster(),
      global.passcode.hasPasscode,
      global.passcode.isScreenLocked,
      settings.hasPushNotifications,
      settings.hasWebNotifications,
      settings.shouldShowPushPreviewsWhenLocked,
    ];

    if (!areArraysShallowEqual(signature, previousSignature)) {
      previousSignature = signature;

      if (canPreparePush()) void reconcilePushNotifications();
    }

    if (pendingClick) void openPendingPushClick();

    const isReady = canHandlePush();
    if (isReady && !wasReady) notifyPushClientReady();
    wasReady = isReady;
  });

  // Settings changes in any tab reconcile through the callback above, so periodic retries belong to the master tab
  function reconcileInMasterTab() {
    if (isCurrentTabMaster()) void reconcilePushNotifications();
  }

  window.addEventListener('online', reconcileInMasterTab);
  window.addEventListener('focus', reconcileInMasterTab);
  setInterval(reconcileInMasterTab, RETRY_INTERVAL_MS);

  void reconcilePushNotifications();
}

export async function handlePushWorkerMessage(e: MessageEvent) {
  const { type, payload } = e.data || {};

  if (type === 'reconcilePush') {
    void reconcilePushNotifications();
  } else if (type === 'claimPush') {
    const identity = await getPushIdentity();
    const meta = await loadPasscodeMeta();
    const isPageActive = IS_TOUCH_ENV ? !document.hidden : document.hasFocus();
    // Encrypted pushes are classified after decryption, and stay unclaimed when that fails
    const kind = payload?.p ? (await decryptPush(payload.p))?.kind : payload?.kind;

    // An active page stays silent on purpose. An unfocused desktop page notifies locally, so it claims only encrypted
    // pushes, which cannot be matched to its notifications; plaintext pushes are deduplicated by the worker instead.
    // Stories never get local notifications, so they are left to the worker.
    e.ports[0]?.postMessage(
      canHandlePush()
      && kind !== undefined
      && kind !== 'story'
      && (isPageActive || (!IS_TOUCH_ENV && Boolean(payload?.p)))
      && !meta?.isLocked
      && identity?.userHash === payload?.userHash
      && identity?.slot === payload?.slot,
    );
  } else if (type === 'openPushNotification') {
    if (!payload?.id || payload.id === lastHandledClickId) return;

    if (pendingClick?.id !== payload.id || pendingClick?.userHash !== payload.userHash) pendingClick = payload;

    await openPendingPushClick();
  }
}

export function notifyPushClientReady() {
  if (!canHandlePush()) return;

  void getPushIdentity().then((identity) => {
    navigator.serviceWorker.controller?.postMessage({ type: 'pushClientReady', payload: identity });
  });
}

async function openPendingPushClick() {
  if (!pendingClick || isOpeningClick || !canHandlePush()) return;

  isOpeningClick = true;
  const notification = pendingClick;

  try {
    if (Date.now() - (notification.clickedAt || 0) > PUSH_CLICK_TIMEOUT_MS) {
      // A click that waited too long for the app to load would navigate unexpectedly
      if (pendingClick === notification) pendingClick = undefined;
      navigator.serviceWorker.controller?.postMessage({
        type: 'pushClickHandled',
        payload: { id: notification.id, userHash: notification.userHash },
      });
      return;
    }

    const identity = await getPushIdentity();

    if (identity?.slot !== notification.slot || identity.userHash !== notification.userHash) {
      // The worker keeps the click and delivers it again on the next `pushClientReady`
      if (pendingClick === notification) pendingClick = undefined;
      return;
    }

    const generation = getDekGeneration();
    const meta = await loadPasscodeMeta();

    if (meta?.isLocked) return;

    let target = notification;

    if (notification.p) {
      const pushTarget = await decryptPush(notification.p);

      target = pushTarget ? { ...notification, ...pushTarget } : { ...notification, chatId: undefined };
    }

    const latestMeta = await loadPasscodeMeta();

    if (
      !canHandlePush()
      || generation !== getDekGeneration()
      || latestMeta?.isLocked
      || latestMeta?.lockEpoch !== meta?.lockEpoch
    ) return;

    openPushTarget(target);

    lastHandledClickId = notification.id;
    navigator.serviceWorker.controller?.postMessage({
      type: 'pushClickHandled',
      payload: { id: notification.id, userHash: identity.userHash },
    });

    if (pendingClick === notification) pendingClick = undefined;
  } finally {
    isOpeningClick = false;

    if (pendingClick && pendingClick !== notification) void openPendingPushClick();
  }
}

async function decryptPush(payload: string) {
  const session = loadSlotSession(CURRENT_SLOT);
  if (!session?.pushKey || !session.userId) return undefined;

  const data = await callApi('decryptPushNotification', {
    payload,
    key: base64UrlToBuffer(session.pushKey),
    userId: session.userId,
  }).catch(() => undefined);

  return data ? getPushTarget(data) : undefined;
}

function openPushTarget(target: PushNotification) {
  const actions = getActions();
  const tabId = getCurrentTabId();

  if (target.kind === 'story' && (target.chatId || target.isStoryReaction)) {
    actions.openChat({ id: undefined, tabId });

    actions.openStoryViewer({
      peerId: target.isStoryReaction ? getGlobal().currentUserId! : target.chatId!,
      storyId: target.storyId,
      tabId,
    });
  } else if (target.chatId && selectChat(getGlobal(), target.chatId)) {
    if (target.messageId) {
      actions.focusMessage({
        chatId: target.chatId,
        messageId: target.messageId,
        threadId: target.threadId,
        shouldReplaceHistory: target.shouldReplaceHistory,
        tabId,
      });
    } else {
      actions.openChat({ id: target.chatId, tabId });
    }
  } else {
    actions.openChat({ id: undefined, tabId });
  }
}

function canManagePush() {
  return canPreparePush()
    && isCurrentTabMaster()
    && Boolean(VAPID_SERVER_KEY)
    && 'PushManager' in window
    && 'Notification' in window
    && Notification.permission === 'granted'
    && getGlobal().connectionState === 'connectionStateReady';
}

function canPreparePush() {
  const global = getGlobal();

  return global.isInited
    && !IS_TAURI
    && 'serviceWorker' in navigator
    && !isSessionStoreLocked()
    && !global.passcode.isScreenLocked
    && Boolean(global.currentUserId);
}

function canHandlePush() {
  const global = getGlobal();

  return global.isInited
    && !global.passcode.isScreenLocked
    && Boolean(global.currentUserId)
    && Boolean(global.isSynced)
    && (!global.passcode.hasPasscode || Boolean(getDek()))
    && global.connectionState === 'connectionStateReady'
    && selectTabState(global, getCurrentTabId())?.uiReadyState === 2;
}
