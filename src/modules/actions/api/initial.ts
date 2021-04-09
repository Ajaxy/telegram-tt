import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import { GRAMJS_SESSION_ID_KEY } from '../../../config';
import { initApi, callApi } from '../../../api/gramjs';

addReducer('initApi', (global: GlobalState, actions) => {
  const sessionId = localStorage.getItem(GRAMJS_SESSION_ID_KEY) || undefined;

  void initApi(actions.apiUpdate, sessionId);

  return {
    ...global,
    authIsSessionRemembered: Boolean(sessionId),
  };
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
  const { sessionId } = payload!;
  localStorage.setItem(GRAMJS_SESSION_ID_KEY, sessionId);
});

addReducer('signOut', () => {
  void signOut();
});

async function signOut() {
  await callApi('destroy');
  localStorage.removeItem(GRAMJS_SESSION_ID_KEY);

  getDispatch().init();
}

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
