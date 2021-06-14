import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import {
  LANG_CACHE_NAME,
  CUSTOM_BG_CACHE_NAME,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME,
  IS_TEST,
} from '../../../config';
import { initApi, callApi } from '../../../api/gramjs';
import { unsubscribe } from '../../../util/notifications';
import * as cacheApi from '../../../util/cacheApi';
import { HistoryWrapper } from '../../../util/history';
import { updateAppBadge } from '../../../util/appBadge';
import {
  storeSession,
  loadStoredSession,
  clearStoredSession,
  importLegacySession,
  clearLegacySessions,
  importTestSession,
} from './sessions';

addReducer('initApi', (global: GlobalState, actions) => {
  (async () => {
    if (!IS_TEST) {
      await importLegacySession();
      void clearLegacySessions();
    } else {
      importTestSession();
    }

    void initApi(actions.apiUpdate, loadStoredSession());
  })();
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

  HistoryWrapper.pushState({
    type: 'login',
    contentKey: 'authQr',
  });

  return {
    ...global,
    authIsLoadingQrCode: true,
    authError: undefined,
  };
});

addReducer('saveSession', (global, actions, payload) => {
  const { sessionData } = payload;

  if (sessionData) {
    storeSession(payload.sessionData, global.currentUserId);
  } else {
    clearStoredSession();
  }
});

addReducer('signOut', () => {
  (async () => {
    await unsubscribe();
    await callApi('destroy');

    getDispatch().reset();
  })();
});

addReducer('reset', () => {
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
