import { addActionHandler, getActions, getGlobal } from '../../index';

import { initApi, callApi } from '../../../api/gramjs';

import {
  LANG_CACHE_NAME,
  CUSTOM_BG_CACHE_NAME,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
  IS_TEST,
} from '../../../config';
import { IS_MOV_SUPPORTED, IS_WEBM_SUPPORTED, PLATFORM_ENV } from '../../../util/environment';
import { unsubscribe } from '../../../util/notifications';
import * as cacheApi from '../../../util/cacheApi';
import { updateAppBadge } from '../../../util/appBadge';
import {
  storeSession,
  loadStoredSession,
  clearStoredSession,
  importLegacySession,
  clearLegacySessions,
} from '../../../util/sessions';
import { forceWebsync } from '../../../util/websync';

addActionHandler('initApi', async (global, actions) => {
  if (!IS_TEST) {
    await importLegacySession();
    void clearLegacySessions();
  }

  void initApi(actions.apiUpdate, {
    userAgent: navigator.userAgent,
    platform: PLATFORM_ENV,
    sessionData: loadStoredSession(),
    isTest: window.location.search.includes('test'),
    isMovSupported: IS_MOV_SUPPORTED,
    isWebmSupported: IS_WEBM_SUPPORTED,
  });
});

addActionHandler('setAuthPhoneNumber', (global, actions, payload) => {
  const { phoneNumber } = payload!;

  void callApi('provideAuthPhoneNumber', phoneNumber.replace(/[^\d]/g, ''));

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addActionHandler('setAuthCode', (global, actions, payload) => {
  const { code } = payload!;

  void callApi('provideAuthCode', code);

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addActionHandler('setAuthPassword', (global, actions, payload) => {
  const { password } = payload!;

  void callApi('provideAuthPassword', password);

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addActionHandler('uploadProfilePhoto', (global, actions, payload) => {
  const { file } = payload!;

  void callApi('uploadProfilePhoto', file);
});

addActionHandler('signUp', (global, actions, payload) => {
  const { firstName, lastName } = payload!;

  void callApi('provideAuthRegistration', { firstName, lastName });

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addActionHandler('returnToAuthPhoneNumber', (global) => {
  void callApi('restartAuth');

  return {
    ...global,
    authError: undefined,
  };
});

addActionHandler('goToAuthQrCode', (global) => {
  void callApi('restartAuthWithQr');

  return {
    ...global,
    authIsLoadingQrCode: true,
    authError: undefined,
  };
});

addActionHandler('saveSession', (global, actions, payload) => {
  const { sessionData } = payload;

  if (sessionData) {
    storeSession(payload.sessionData, global.currentUserId);
  } else {
    clearStoredSession();
  }
});

addActionHandler('signOut', async (_global, _actions, payload) => {
  try {
    await unsubscribe();
    await callApi('destroy');
    await forceWebsync(false);
  } catch (err) {
    // Do nothing
  }

  getActions().reset();

  if (payload?.forceInitApi) {
    getActions().initApi();
  }
});

addActionHandler('reset', () => {
  clearStoredSession();

  void cacheApi.clear(MEDIA_CACHE_NAME);
  void cacheApi.clear(MEDIA_CACHE_NAME_AVATARS);
  void cacheApi.clear(MEDIA_PROGRESSIVE_CACHE_NAME);
  void cacheApi.clear(CUSTOM_BG_CACHE_NAME);

  const langCachePrefix = LANG_CACHE_NAME.replace(/\d+$/, '');
  const langCacheVersion = (LANG_CACHE_NAME.match(/\d+$/) || [0])[0];
  for (let i = 0; i < langCacheVersion; i++) {
    void cacheApi.clear(`${langCachePrefix}${i === 0 ? '' : i}`);
  }

  void clearLegacySessions();

  updateAppBadge(0);

  getActions().init();
});

addActionHandler('disconnect', () => {
  void callApi('disconnect');
});

addActionHandler('loadNearestCountry', async (global) => {
  if (global.connectionState !== 'connectionStateReady') {
    return undefined;
  }

  const authNearestCountry = await callApi('fetchNearestCountry');

  return {
    ...getGlobal(),
    authNearestCountry,
  };
});

addActionHandler('setDeviceToken', (global, actions, deviceToken) => {
  return {
    ...global,
    push: {
      deviceToken,
      subscribedAt: Date.now(),
    },
  };
});

addActionHandler('deleteDeviceToken', (global) => {
  return {
    ...global,
    push: undefined,
  };
});
