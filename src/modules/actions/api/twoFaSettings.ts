import { addReducer, getGlobal, setGlobal } from '../..';

import { callApi } from '../../../api/gramjs';
import { replaceSettings, updateTwoFaSettings } from '../../reducers';

addReducer('loadPasswordInfo', () => {
  (async () => {
    const result = await callApi('getPasswordInfo');
    if (!result) {
      return;
    }

    let global = getGlobal();
    global = replaceSettings(global, { hasPassword: result.hasPassword });
    global = updateTwoFaSettings(global, { hint: result.hint });
    setGlobal(global);
  })();
});

addReducer('checkPassword', (global, actions, payload) => {
  const { currentPassword, onSuccess } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  (async () => {
    const isSuccess = await callApi('checkPassword', currentPassword);

    setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false }));

    if (isSuccess) {
      onSuccess();
    }
  })();
});

addReducer('clearPassword', (global, actions, payload) => {
  const { currentPassword, onSuccess } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  (async () => {
    const isSuccess = await callApi('clearPassword', currentPassword);

    setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false }));

    if (isSuccess) {
      onSuccess();
    }
  })();
});

addReducer('updatePassword', (global, actions, payload) => {
  const {
    currentPassword, password, hint, email, onSuccess,
  } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  (async () => {
    const isSuccess = await callApi('updatePassword', currentPassword, password, hint, email);

    setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false }));

    if (isSuccess) {
      onSuccess();
    }
  })();
});

addReducer('updateRecoveryEmail', (global, actions, payload) => {
  const {
    currentPassword, email, onSuccess,
  } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  (async () => {
    const isSuccess = await callApi('updateRecoveryEmail', currentPassword, email);

    setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false, waitingEmailCodeLength: undefined }));

    if (isSuccess) {
      onSuccess();
    }
  })();
});

addReducer('provideTwoFaEmailCode', (global, actions, payload) => {
  const { code } = payload;

  void callApi('provideRecoveryEmailCode', code);
});

addReducer('clearTwoFaError', (global) => {
  return updateTwoFaSettings(global, { error: undefined });
});
