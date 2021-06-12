import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import {
  LANG_CACHE_NAME,
  CUSTOM_BG_CACHE_NAME,
  GRAMJS_SESSION_ID_KEY,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
  LEGACY_SESSION_KEY,
} from '../../../config';
import { initApi, callApi } from '../../../api/gramjs';
import { unsubscribe } from '../../../util/notifications';
import * as cacheApi from '../../../util/cacheApi';
import { updateAppBadge } from '../../../util/appBadge';

addReducer('initApi', (global: GlobalState, actions) => {
  let sessionInfo = localStorage.getItem(GRAMJS_SESSION_ID_KEY) || undefined;

  if (!sessionInfo) {
    const legacySessionJson = localStorage.getItem(LEGACY_SESSION_KEY);
    if (legacySessionJson) {
      const { dcID: legacySessionMainDc } = JSON.parse(legacySessionJson);
      const legacySessionMainKeyRaw = localStorage.getItem(`dc${legacySessionMainDc}_auth_key`);
      if (legacySessionMainKeyRaw) {
        const legacySessionMainDcKey = legacySessionMainKeyRaw.replace(/"/g, '');
        sessionInfo = `session:${legacySessionMainDc}:${legacySessionMainDcKey}`;
      }
    }
  }

  void initApi(actions.apiUpdate, sessionInfo);
});

addReducer('setAuthPhoneNumber', (global, actions, payload) => {
  const { phoneNumber } = payload!;

  void callApi('provideAuthPhoneNumber', phoneNumber);

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addReducer('setAuthCode', (global, actions, payload) => {
  const { code } = payload!;

  void callApi('provideAuthCode', code);

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addReducer('setAuthPassword', (global, actions, payload) => {
  const { password } = payload!;

  void callApi('provideAuthPassword', password);

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addReducer('uploadProfilePhoto', (global, actions, payload) => {
  const { file } = payload!;

  void callApi('uploadProfilePhoto', file);
});

addReducer('signUp', (global, actions, payload) => {
  const { firstName, lastName } = payload!;

  void callApi('provideAuthRegistration', { firstName, lastName });

  return {
    ...global,
    authIsLoading: true,
    authError: undefined,
  };
});

addReducer('returnToAuthPhoneNumber', (global) => {
  void callApi('restartAuth');

  return {
    ...global,
    authError: undefined,
  };
});

addReducer('gotToAuthQrCode', (global) => {
  void callApi('restartAuthWithQr');

  return {
    ...global,
    authIsLoadingQrCode: true,
    authError: undefined,
  };
});

addReducer('saveSession', (global, actions, payload) => {
  const { sessionId, sessionJson } = payload!;
  localStorage.setItem(GRAMJS_SESSION_ID_KEY, sessionId);

  exportLegacySession(sessionJson, global.currentUserId!);
});

addReducer('signOut', () => {
  (async () => {
    await unsubscribe();
    await callApi('destroy');

    getDispatch().reset();
  })();
});

addReducer('reset', () => {
  localStorage.removeItem(GRAMJS_SESSION_ID_KEY);
  clearLegacySession();

  cacheApi.clear(MEDIA_CACHE_NAME);
  cacheApi.clear(MEDIA_CACHE_NAME_AVATARS);
  cacheApi.clear(MEDIA_PROGRESSIVE_CACHE_NAME);
  cacheApi.clear(CUSTOM_BG_CACHE_NAME);

  const langCachePrefix = LANG_CACHE_NAME.replace(/\d+$/, '');
  const langCacheVersion = (LANG_CACHE_NAME.match(/\d+$/) || [0])[0];
  for (let i = 0; i < langCacheVersion; i++) {
    cacheApi.clear(`${langCachePrefix}${i === 0 ? '' : i}`);
  }

  updateAppBadge(0);

  getDispatch().init();
});

addReducer('disconnect', () => {
  (async () => {
    await callApi('disconnect');
  })();
});

addReducer('loadNearestCountry', (global) => {
  if (global.connectionState !== 'connectionStateReady') {
    return;
  }

  (async () => {
    const authNearestCountry = await callApi('fetchNearestCountry');

    setGlobal({
      ...getGlobal(),
      authNearestCountry,
    });
  })();
});


addReducer('setDeviceToken', (global, actions, deviceToken) => {
  setGlobal({
    ...global,
    push: {
      deviceToken,
      subscribedAt: Date.now(),
    },
  });
});

addReducer('deleteDeviceToken', (global) => {
  const newGlobal = { ...global };
  delete newGlobal.push;
  setGlobal(newGlobal);
});

function exportLegacySession(sessionJson: string, currentUserId: number) {
  const { mainDcId, keys } = JSON.parse(sessionJson);
  const legacySession = { dcID: mainDcId, id: currentUserId };
  localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(legacySession));
  localStorage.setItem('dc', mainDcId);
  Object.keys(keys).forEach((dcId) => {
    localStorage.setItem(`dc${dcId}_auth_key`, `"${keys[dcId]}"`);
  });
}

function clearLegacySession() {
  localStorage.removeItem('dc5_auth_key');
  localStorage.removeItem('dc4_auth_key');
  localStorage.removeItem('dc3_auth_key');
  localStorage.removeItem('dc2_auth_key');
  localStorage.removeItem('dc1_auth_key');
  localStorage.removeItem('dc');
  localStorage.removeItem(LEGACY_SESSION_KEY);
}
