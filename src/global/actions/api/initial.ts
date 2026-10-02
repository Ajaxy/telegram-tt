import type { ActionReturnType } from '../../types';
import { ManagementProgress } from '../../../types';

import {
  IS_SCREEN_LOCKED_CACHE_KEY,
  LANG_CACHE_NAME,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
} from '../../../config';
import { updateAppBadge } from '../../../util/appBadge';
import { MAIN_IDB_STORE } from '../../../util/browser/idb';
import { toCredentialRequestOptions } from '../../../util/browser/passkeys';
import {
  IS_WEBAUTHN_SUPPORTED,
  IS_WEBM_SUPPORTED, MAX_BUFFER_SIZE, PLATFORM_ENV,
} from '../../../util/browser/windowEnvironment';
import * as cacheApi from '../../../util/cacheApi';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { parseGramJsSessionString } from '../../../util/gramjsSessionString';
import {
  ACCOUNT_SLOT, getAccountsInfo, getAccountSlotUrl, getFirstLoggedInAccountSlot,
} from '../../../util/multiaccount';
import { unsubscribe } from '../../../util/notifications';
import {
  clearPasscodeStore, removeGlobalsVaultForSlot, requestPasscodeStateLock,
} from '../../../util/passcode';
import { broadcastPasscodeReset } from '../../../util/passcode/channel';
import {
  consumeInvalidWebLogin, getPendingWebLogin, parseInitialLocationHash, resetInitialLocationHash, resetLocationHash,
} from '../../../util/routing';
import { pause } from '../../../util/schedulers';
import {
  checkSessionLocked,
  clearAllStoredSessions,
  clearStoredSession,
  hasStoredSession,
  loadStoredSession,
  storeSession,
} from '../../../util/sessions';
import { clearWallpaperBlobs } from '../../../util/wallpaperStorage';
import { interruptWebLogin, rejectWebLogin, resolveWebLogin } from '../../../util/webLogin';
import { webLoginHandoffPromise } from '../../../util/webLoginHandoff';
import { forceWebsync } from '../../../util/websync';
import {
  callApi, callApiLocal, closeApi, initApi, setShouldEnableDebugLog,
} from '../../../api/gramjs';
import { removeGlobalFromCache, removeSharedStateFromCache } from '../../cache';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  updateManagementProgress,
} from '../../reducers';
import { updateAuth } from '../../reducers/auth';
import { selectTabState } from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';
import { destroySharedStatePort, resetSharedStatePort } from '../../shared/sharedStateConnector';

let resetStoragePromise: Promise<boolean> | undefined;
let isInitializingApi = false;

const API_DESTROY_TIMEOUT_MS = 3000;

addActionHandler('initApi', async (global, actions): Promise<void> => {
  if (isInitializingApi) return;
  isInitializingApi = true;
  try {
    if (global.passcode.isScreenLocked || checkSessionLocked()) return;
    if (!await webLoginHandoffPromise) rejectWebLogin();
    if (consumeInvalidWebLogin()) rejectWebLogin(true);
    interruptWebLogin();
    if (getPendingWebLogin() && !await resolveWebLogin()) return;
    global = getGlobal();
    if (global.passcode.isScreenLocked || checkSessionLocked()
      || !selectTabState(global, getCurrentTabId()).isMasterTab) return;
    const request = getPendingWebLogin();
    const token = hasStoredSession() ? undefined : request?.token;
    // Clearing the token marks it as dispatched so `interruptWebLogin()` rejects interrupted logins and prevents replay
    if (token) request!.token = undefined;

    const initialLocationHash = parseInitialLocationHash();
    const {
      shouldAllowHttpTransport,
      shouldForceHttpTransport,
      shouldDebugExportedSenders,
      shouldCollectDebugLogs,
      language,
    } = selectSharedSettings(global);

    const hasTestParam = request ? request.isTest : window.location.search.includes('test');

    const isTestServer = request?.isTest ?? global.config?.isTestServer ?? hasTestParam;
    const accountsInfo = getAccountsInfo();
    const accountIds = Object.values(accountsInfo)
      .filter((info) => Boolean(info.isTest) === isTestServer)
      .map(({ userId }) => userId)
      .filter(Boolean);

    void initApi(actions.apiUpdate, {
      userAgent: navigator.userAgent,
      platform: PLATFORM_ENV,
      sessionData: loadStoredSession(),
      isWebmSupported: IS_WEBM_SUPPORTED,
      maxBufferSize: MAX_BUFFER_SIZE,
      webAuthToken: token,
      webAuthUserId: token ? request!.userId : undefined,
      dcId: token ? request!.dcId : undefined,
      mockScenario: initialLocationHash?.mockScenario,
      shouldAllowHttpTransport,
      shouldForceHttpTransport,
      shouldDebugExportedSenders,
      langCode: language,
      isTestServerRequested: hasTestParam,
      accountIds,
      hasPasskeySupport: IS_WEBAUTHN_SUPPORTED,
    });

    void setShouldEnableDebugLog(Boolean(shouldCollectDebugLogs));
  } finally {
    isInitializingApi = false;
  }
});

addActionHandler('setAuthPhoneNumber', (global, actions, payload): ActionReturnType => {
  const { phoneNumber } = payload;

  void callApi('provideAuthPhoneNumber', phoneNumber.replace(/[^\d]/g, ''));

  return updateAuth(global, {
    isLoading: true,
    errorKey: undefined,
  });
});

addActionHandler('setAuthCode', (global, actions, payload): ActionReturnType => {
  const { code } = payload;

  void callApi('provideAuthCode', code);

  return updateAuth(global, {
    isLoading: true,
    errorKey: undefined,
  });
});

addActionHandler('setAuthPassword', (global, actions, payload): ActionReturnType => {
  const { password } = payload;

  void callApi('provideAuthPassword', password);

  return updateAuth(global, {
    isLoading: true,
    errorKey: undefined,
  });
});

addActionHandler('loginWithPasskey', async (global, actions, payload): Promise<void> => {
  const passkeyOption = global.auth.passkeyOption;
  if (!passkeyOption) return;

  const credential = await navigator.credentials.get(toCredentialRequestOptions(passkeyOption)).catch((e: unknown) => {
    actions.showNotification({
      message: {
        key: 'PasskeyLoginError',
      },
      tabId: getCurrentTabId(),
    });
  });
  if (!credential) return;

  const publicKeyCredential = credential as PublicKeyCredential;
  callApi('restartAuthWithPasskey', publicKeyCredential.toJSON() as AuthenticationResponseJSON);
});

addActionHandler('uploadProfilePhoto', async (global, actions, payload): Promise<void> => {
  const {
    file, isFallback, isVideo, videoTs, bot,
    tabId = getCurrentTabId(),
  } = payload;

  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  const result = await callApi('uploadProfilePhoto', file, isFallback, isVideo, videoTs, bot);
  if (!result) return;

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  setGlobal(global);

  const userId = bot?.id ?? global.currentUserId;
  if (!userId) return;

  actions.loadFullUser({ userId });
});

addActionHandler('signUp', (global, actions, payload): ActionReturnType => {
  const { firstName, lastName } = payload;

  void callApi('provideAuthRegistration', { firstName, lastName });

  return updateAuth(global, {
    isLoading: true,
    errorKey: undefined,
  });
});

addActionHandler('importAuthSessionString', async (global, actions, payload): Promise<void> => {
  const { sessionString } = payload;

  const sessionData = parseGramJsSessionString(sessionString);

  if (!sessionData) {
    global = updateAuth(global, {
      errorKey: { key: 'ErrorSessionStringInvalid' },
      isLoading: false,
    });
    setGlobal(global);
    return;
  }

  global = updateAuth(global, {
    isLoading: true,
    errorKey: undefined,
  });
  setGlobal(global);

  await storeSession(sessionData);

  // The app is restarted to connect with the imported authorization key
  window.location.reload();
});

addActionHandler('returnToAuthPhoneNumber', (global): ActionReturnType => {
  void callApi('restartAuth');

  return updateAuth(global, {
    errorKey: undefined,
  });
});

addActionHandler('goToAuthQrCode', (global): ActionReturnType => {
  void callApi('restartAuthWithQr');

  return updateAuth(global, {
    isLoadingQrCode: true,
    errorKey: undefined,
  });
});

addActionHandler('saveSession', async (global, actions, payload): Promise<void> => {
  if (global.passcode.isScreenLocked) {
    return;
  }

  const { sessionData } = payload;
  if (sessionData) {
    await storeSession(sessionData);
  } else {
    await clearStoredSession();
  }
});

addActionHandler('signOut', async (global, actions, payload): Promise<void> => {
  if ('hangUp' in actions) actions.hangUp({ tabId: getCurrentTabId() });
  if ('leaveGroupCall' in actions) actions.leaveGroupCall({ tabId: getCurrentTabId() });

  try {
    resetInitialLocationHash();
    resetLocationHash();
    await unsubscribe();
    await Promise.race([callApi('destroy'), pause(API_DESTROY_TIMEOUT_MS)]);
    await forceWebsync(false);
  } catch (err) {
    // Do nothing
  }

  actions.reset();
  await resetStorage();

  const targetAccountSlot = getFirstLoggedInAccountSlot() || 1;
  if (targetAccountSlot !== (ACCOUNT_SLOT || 1)) {
    window.location.replace(getAccountSlotUrl(targetAccountSlot));
    return;
  }

  if (payload?.forceInitApi) {
    actions.initApi();
  }
});

addActionHandler('requestChannelDifference', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;

  void callApi('requestChannelDifference', chatId);
});

addActionHandler('reset', async (global, actions): Promise<void> => {
  void cacheApi.clear(MEDIA_CACHE_NAME);
  void cacheApi.clear(MEDIA_CACHE_NAME_AVATARS);
  void cacheApi.clear(MEDIA_PROGRESSIVE_CACHE_NAME);

  const hasAccounts = await resetStorage();
  if (hasAccounts) {
    destroySharedStatePort();
  } else {
    resetSharedStatePort();
  }

  if (!hasAccounts) {
    await clearPasscodeStore();
    localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
    await clearWallpaperBlobs();
  }

  const langCachePrefix = LANG_CACHE_NAME.replace(/\d+$/, '');
  const langCacheVersion = Number((LANG_CACHE_NAME.match(/\d+$/) || ['0'])[0]);
  for (let i = 0; i < langCacheVersion; i++) {
    void cacheApi.clear(`${langCachePrefix}${i === 0 ? '' : i}`);
  }

  updateAppBadge(0);

  if (hasAccounts) {
    return;
  }

  actions.initShared({ force: true });
  Object.values(global.byTabId).forEach(({ id: otherTabId, isMasterTab }) => {
    actions.init({ tabId: otherTabId, isMasterTab });
  });
});

function resetStorage() {
  if (resetStoragePromise) return resetStoragePromise;

  const clearSessionPromise = clearStoredSession(ACCOUNT_SLOT);
  const clearGlobalsVaultPromise = requestPasscodeStateLock(() => removeGlobalsVaultForSlot(ACCOUNT_SLOT));

  resetStoragePromise = Promise.all([
    clearSessionPromise,
    clearGlobalsVaultPromise,
    removeGlobalFromCache(),
  ]).then(async () => {
    const hasAccounts = Boolean(Object.values(getAccountsInfo()).length);
    if (!hasAccounts) await removeSharedStateFromCache();
    return hasAccounts;
  }).finally(() => {
    resetStoragePromise = undefined;
  });

  return resetStoragePromise;
}

addActionHandler('disconnect', (): ActionReturnType => {
  void callApiLocal('disconnect');
});

addActionHandler('destroyConnection', (): ActionReturnType => {
  if (getPendingWebLogin()) {
    interruptWebLogin();
    void closeApi(false);
    return;
  }
  void callApiLocal('destroy', true, true);
});

addActionHandler('loadNearestCountry', async (global): Promise<void> => {
  if (global.connectionState !== 'connectionStateReady') {
    return;
  }

  const authNearestCountry = await callApi('fetchNearestCountry');

  global = getGlobal();
  global = updateAuth(global, {
    nearestCountry: authNearestCountry,
  });
  setGlobal(global);
});

addActionHandler('setDeviceToken', (global, actions, payload): ActionReturnType => {
  const { token } = payload;
  return {
    ...global,
    push: {
      deviceToken: token,
      subscribedAt: Date.now(),
    },
  };
});

addActionHandler('deleteDeviceToken', (global): ActionReturnType => {
  return {
    ...global,
    push: undefined,
  };
});

addActionHandler('signOutAllAccounts', async (): Promise<void> => {
  try {
    await Promise.race([unsubscribe(), pause(API_DESTROY_TIMEOUT_MS)]);
    await Promise.race([callApi('destroy'), pause(API_DESTROY_TIMEOUT_MS)]);
  } catch (err) {
    // Do nothing
  }

  clearAllStoredSessions();
  await clearPasscodeStore().catch(() => undefined);

  try {
    localStorage.clear();
    await MAIN_IDB_STORE.clear();
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    // Do nothing
  }

  broadcastPasscodeReset();
  window.location.reload();
});
