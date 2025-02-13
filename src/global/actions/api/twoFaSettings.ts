import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { replaceSettings, updateTwoFaSettings } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';

addActionHandler('loadPasswordInfo', async (global): Promise<void> => {
  const result = await callApi('getPasswordInfo');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = replaceSettings(global, { hasPassword: result.hasPassword });
  global = updateTwoFaSettings(global, { hint: result.hint });
  setGlobal(global);
});

addActionHandler('checkPassword', async (global, actions, payload): Promise<void> => {
  const { currentPassword, onSuccess } = payload;

  global = updateTwoFaSettings(global, { isLoading: true, errorKey: undefined });
  setGlobal(global);

  const isSuccess = await callApi('checkPassword', currentPassword);

  global = getGlobal();
  global = updateTwoFaSettings(global, { isLoading: false });
  setGlobal(global);

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('clearPassword', async (global, actions, payload): Promise<void> => {
  const { currentPassword, onSuccess } = payload;

  global = updateTwoFaSettings(global, { isLoading: true, errorKey: undefined });
  setGlobal(global);

  const isSuccess = await callApi('clearPassword', currentPassword);

  global = getGlobal();
  global = updateTwoFaSettings(global, { isLoading: false });
  setGlobal(global);

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('updatePassword', async (global, actions, payload): Promise<void> => {
  const {
    currentPassword, password, hint, email, onSuccess,
  } = payload;

  global = updateTwoFaSettings(global, { isLoading: true, errorKey: undefined });
  setGlobal(global);

  const isSuccess = await callApi('updatePassword', currentPassword, password, hint, email);

  global = getGlobal();
  global = updateTwoFaSettings(global, { isLoading: false });
  setGlobal(global);

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('updateRecoveryEmail', async (global, actions, payload): Promise<void> => {
  const {
    currentPassword, email, onSuccess,
    tabId = getCurrentTabId(),
  } = payload;

  global = updateTwoFaSettings(global, { isLoading: true, errorKey: undefined });
  global = updateTabState(global, {
    recoveryEmail: email,
  }, tabId);
  setGlobal(global);

  const isSuccess = await callApi('updateRecoveryEmail', currentPassword, email);

  global = getGlobal();
  global = updateTwoFaSettings(global, { isLoading: false, waitingEmailCodeLength: undefined });
  global = updateTabState(global, {
    recoveryEmail: undefined,
  }, tabId);
  setGlobal(global);

  if (isSuccess) {
    onSuccess();
  }
});

addActionHandler('provideTwoFaEmailCode', (global, actions, payload): ActionReturnType => {
  const { code } = payload;

  void callApi('provideRecoveryEmailCode', code);
});

addActionHandler('clearTwoFaError', (global): ActionReturnType => {
  return updateTwoFaSettings(global, { errorKey: undefined });
});
