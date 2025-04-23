import type { ActionReturnType } from '../../types';
import { ManagementProgress } from '../../../types';

import {
  CUSTOM_BG_CACHE_NAME,
  LANG_CACHE_NAME,
  LOCK_SCREEN_ANIMATION_DURATION_MS,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
} from '../../../config';
import { updateAppBadge } from '../../../util/appBadge';
import { PASSCODE_IDB_STORE } from '../../../util/browser/idb';
import {
  IS_WEBM_SUPPORTED, MAX_BUFFER_SIZE, PLATFORM_ENV,
} from '../../../util/browser/windowEnvironment';
import * as cacheApi from '../../../util/cacheApi';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { ACCOUNT_SLOT, getAccountsInfo } from '../../../util/multiaccount';
import { unsubscribe } from '../../../util/notifications';
import { clearEncryptedSession, encryptSession, forgetPasscode } from '../../../util/passcode';
import { parseInitialLocationHash, resetInitialLocationHash, resetLocationHash } from '../../../util/routing';
import { pause } from '../../../util/schedulers';
import {
  clearStoredSession,
  loadStoredSession,
  storeSession,
} from '../../../util/sessions';
import { forceWebsync } from '../../../util/websync';
import {
  callApi, callApiLocal, initApi, setShouldEnableDebugLog,
} from '../../../api/gramjs';
import { removeGlobalFromCache, removeSharedStateFromCache, serializeGlobal } from '../../cache';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  clearGlobalForLockScreen, updateManagementProgress, updatePasscodeSettings,
} from '../../reducers';
import { selectSharedSettings } from '../../selectors/sharedState';
import { destroySharedStatePort } from '../../shared/sharedStateConnector';

addActionHandler('initApi', (global, actions): ActionReturnType => {
  const initialLocationHash = parseInitialLocationHash();
  const {
    shouldAllowHttpTransport,
    shouldForceHttpTransport,
    shouldDebugExportedSenders,
    shouldCollectDebugLogs,
    language,
  } = selectSharedSettings(global);

  const hasTestParam = window.location.search.includes('test') || initialLocationHash?.tgWebAuthTest === '1';

  const accountsInfo = getAccountsInfo();
  const accountIds = Object.values(accountsInfo).map(({ userId }) => userId)?.filter(Boolean);

  void initApi(actions.apiUpdate, {
    userAgent: navigator.userAgent,
    platform: PLATFORM_ENV,
    sessionData: loadStoredSession(),
    isWebmSupported: IS_WEBM_SUPPORTED,
    maxBufferSize: MAX_BUFFER_SIZE,
    webAuthToken: initialLocationHash?.tgWebAuthToken,
    dcId: initialLocationHash?.tgWebAuthDcId ? Number(initialLocationHash?.tgWebAuthDcId) : undefined,
    mockScenario: initialLocationHash?.mockScenario,
    shouldAllowHttpTransport,
    shouldForceHttpTransport,
    shouldDebugExportedSenders,
    langCode: language,
    isTestServerRequested: hasTestParam,
    accountIds,
  });

  void setShouldEnableDebugLog(Boolean(shouldCollectDebugLogs));
});

addActionHandler('setAuthPhoneNumber', (global, actions, payload): ActionReturnType => {
  const { phoneNumber } = payload!;

  void callApi('provideAuthPhoneNumber', phoneNumber.replace(/[^\d]/g, ''));

  return {
    ...global,
    authIsLoading: true,
    authErrorKey: undefined,
  };
});

addActionHandler('setAuthCode', (global, actions, payload): ActionReturnType => {
  const { code } = payload!;

  void callApi('provideAuthCode', code);

  return {
    ...global,
    authIsLoading: true,
    authErrorKey: undefined,
  };
});

addActionHandler('setAuthPassword', (global, actions, payload): ActionReturnType => {
  const { password } = payload!;

  void callApi('provideAuthPassword', password);

  return {
    ...global,
    authIsLoading: true,
    authErrorKey: undefined,
  };
});

addActionHandler('uploadProfilePhoto', async (global, actions, payload): Promise<void> => {
  const {
    file, isFallback, isVideo, videoTs, bot,
    tabId = getCurrentTabId(),
  } = payload!;

  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  const result = await callApi('uploadProfilePhoto', file, isFallback, isVideo, videoTs, bot);
  if (!result) return;

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  setGlobal(global);

  actions.loadFullUser({ userId: global.currentUserId! });
});

addActionHandler('signUp', (global, actions, payload): ActionReturnType => {
  const { firstName, lastName } = payload!;

  void callApi('provideAuthRegistration', { firstName, lastName });

  return {
    ...global,
    authIsLoading: true,
    authErrorKey: undefined,
  };
});

addActionHandler('returnToAuthPhoneNumber', (global): ActionReturnType => {
  void callApi('restartAuth');

  return {
    ...global,
    authErrorKey: undefined,
  };
});

addActionHandler('goToAuthQrCode', (global): ActionReturnType => {
  void callApi('restartAuthWithQr');

  return {
    ...global,
    authIsLoadingQrCode: true,
    authErrorKey: undefined,
  };
});

addActionHandler('saveSession', (global, actions, payload): ActionReturnType => {
  if (global.passcode.isScreenLocked) {
    return;
  }

  const { sessionData } = payload;
  if (sessionData) {
    storeSession(sessionData);
  } else {
    clearStoredSession();
  }
});

addActionHandler('signOut', async (global, actions, payload): Promise<void> => {
  if ('hangUp' in actions) actions.hangUp({ tabId: getCurrentTabId() });
  if ('leaveGroupCall' in actions) actions.leaveGroupCall({ tabId: getCurrentTabId() });

  try {
    resetInitialLocationHash();
    resetLocationHash();
    await unsubscribe();
    await Promise.race([callApi('destroy'), pause(3000)]);
    await forceWebsync(false);
  } catch (err) {
    // Do nothing
  }

  actions.reset();

  if (payload?.forceInitApi) {
    actions.initApi();
  }
});

addActionHandler('requestChannelDifference', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;

  void callApi('requestChannelDifference', chatId);
});

addActionHandler('reset', (global, actions): ActionReturnType => {
  clearStoredSession(ACCOUNT_SLOT);
  clearEncryptedSession();

  void cacheApi.clear(MEDIA_CACHE_NAME);
  void cacheApi.clear(MEDIA_CACHE_NAME_AVATARS);
  void cacheApi.clear(MEDIA_PROGRESSIVE_CACHE_NAME);
  void cacheApi.clear(CUSTOM_BG_CACHE_NAME);

  removeGlobalFromCache();
  destroySharedStatePort();

  // Check if there are any accounts left
  const accounts = getAccountsInfo();
  if (!Object.values(accounts).length) {
    PASSCODE_IDB_STORE.clear();
    removeSharedStateFromCache();
  }

  const langCachePrefix = LANG_CACHE_NAME.replace(/\d+$/, '');
  const langCacheVersion = Number((LANG_CACHE_NAME.match(/\d+$/) || ['0'])[0]);
  for (let i = 0; i < langCacheVersion; i++) {
    void cacheApi.clear(`${langCachePrefix}${i === 0 ? '' : i}`);
  }

  updateAppBadge(0);

  actions.initShared({ force: true });
  Object.values(global.byTabId).forEach(({ id: otherTabId, isMasterTab }) => {
    actions.init({ tabId: otherTabId, isMasterTab });
  });
});

addActionHandler('disconnect', (): ActionReturnType => {
  void callApiLocal('disconnect');
});

addActionHandler('destroyConnection', (): ActionReturnType => {
  void callApiLocal('destroy', true, true);
});

addActionHandler('loadNearestCountry', async (global): Promise<void> => {
  if (global.connectionState !== 'connectionStateReady') {
    return;
  }

  const authNearestCountry = await callApi('fetchNearestCountry');

  global = getGlobal();
  global = {
    ...global,
    authNearestCountry,
  };
  setGlobal(global);
});

addActionHandler('setDeviceToken', (global, actions, deviceToken): ActionReturnType => {
  return {
    ...global,
    push: {
      deviceToken,
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

addActionHandler('lockScreen', async (global): Promise<void> => {
  const sessionJson = JSON.stringify({ ...loadStoredSession(), userId: global.currentUserId });
  const globalJson = await serializeGlobal(global);

  await encryptSession(sessionJson, globalJson);
  forgetPasscode();
  clearStoredSession();
  updateAppBadge(0);

  global = getGlobal();
  global = updatePasscodeSettings(
    global,
    {
      isScreenLocked: true,
      invalidAttemptsCount: 0,
      timeoutUntil: undefined,
    },
  );
  setGlobal(global);

  setTimeout(() => {
    global = getGlobal();
    global = clearGlobalForLockScreen(global);
    setGlobal(global);
  }, LOCK_SCREEN_ANIMATION_DURATION_MS);

  try {
    await unsubscribe();
    await callApi('destroy', true);
  } catch (err) {
    // Do nothing
  }
});
