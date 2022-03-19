import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { callApi } from '../../../api/gramjs';
import { replaceSettings, updateTwoFaSettings } from '../../reducers';

addActionHandler('loadPasswordInfo', async (global) => {
  const result = await callApi('getPasswordInfo');
  if (!result) {
    return undefined;
  }

  global = getGlobal();
  global = replaceSettings(global, { hasPassword: result.hasPassword });
  global = updateTwoFaSettings(global, { hint: result.hint });
  return global;
});

addActionHandler('checkPassword', async (global, actions, payload) => {
  const { currentPassword, onSuccess } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  const isSuccess = await callApi('checkPassword', currentPassword);

  setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false }));

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('clearPassword', async (global, actions, payload) => {
  const { currentPassword, onSuccess } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  const isSuccess = await callApi('clearPassword', currentPassword);

  setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false }));

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('updatePassword', async (global, actions, payload) => {
  const {
    currentPassword, password, hint, email, onSuccess,
  } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  const isSuccess = await callApi('updatePassword', currentPassword, password, hint, email);

  setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false }));

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('updateRecoveryEmail', async (global, actions, payload) => {
  const {
    currentPassword, email, onSuccess,
  } = payload;

  setGlobal(updateTwoFaSettings(global, { isLoading: true, error: undefined }));

  const isSuccess = await callApi('updateRecoveryEmail', currentPassword, email);

  setGlobal(updateTwoFaSettings(getGlobal(), { isLoading: false, waitingEmailCodeLength: undefined }));

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('provideTwoFaEmailCode', (global, actions, payload) => {
  const { code } = payload;

  void callApi('provideRecoveryEmailCode', code);
});

addActionHandler('clearTwoFaError', (global) => {
  return updateTwoFaSettings(global, { error: undefined });
});
