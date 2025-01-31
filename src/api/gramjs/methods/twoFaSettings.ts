import { Api as GramJs } from '../../../lib/gramjs';

import { checkErrorType, wrapError } from '../helpers/misc';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import {
  getCurrentPassword, getTmpPassword, invokeRequest, updateTwoFaSettings,
} from './client';

const emailCodeController: {
  resolve?: Function;
  reject?: Function;
} = {};

export async function getPasswordInfo() {
  const result = await invokeRequest(new GramJs.account.GetPassword());
  if (!result) {
    return undefined;
  }

  const { hint, hasPassword } = result;

  return { hint, hasPassword };
}

function onRequestEmailCode(length: number) {
  sendApiUpdate({
    '@type': 'updateTwoFaStateWaitCode',
    length,
  });

  return new Promise<string>((resolve, reject) => {
    emailCodeController.resolve = resolve;
    emailCodeController.reject = reject;
  });
}

export function getTemporaryPaymentPassword(password: string, ttl?: number) {
  try {
    return getTmpPassword(password, ttl);
  } catch (err: unknown) {
    if (!checkErrorType(err)) return undefined;

    return Promise.resolve(wrapError(err));
  }
}

export function getPassword(password: string) {
  try {
    return getCurrentPassword(password);
  } catch (err: unknown) {
    if (!checkErrorType(err)) return undefined;

    return Promise.resolve(wrapError(err));
  }
}

export async function checkPassword(currentPassword: string) {
  try {
    await updateTwoFaSettings({ isCheckPassword: true, currentPassword });

    return true;
  } catch (err: any) {
    onError(err);

    return false;
  }
}

export async function clearPassword(currentPassword: string) {
  try {
    await updateTwoFaSettings({ currentPassword });

    return true;
  } catch (err: any) {
    onError(err);

    return false;
  }
}

export async function updatePassword(currentPassword: string, password: string, hint?: string, email?: string) {
  try {
    await updateTwoFaSettings({
      currentPassword,
      newPassword: password,
      hint,
      email,
      emailCodeCallback: onRequestEmailCode,
      onEmailCodeError: onError,
    });

    return true;
  } catch (err: any) {
    onError(err);

    return false;
  }
}

export async function updateRecoveryEmail(currentPassword: string, email: string) {
  try {
    await updateTwoFaSettings({
      currentPassword,
      newPassword: currentPassword,
      email,
      emailCodeCallback: onRequestEmailCode,
      onEmailCodeError: onError,
    });

    return true;
  } catch (err: any) {
    onError(err);

    return false;
  }
}

export function provideRecoveryEmailCode(code: string) {
  emailCodeController.resolve!(code);
}

function onError(err: Error) {
  const wrappedError = wrapError(err);

  sendApiUpdate({
    '@type': 'updateTwoFaError',
    messageKey: wrappedError.messageKey,
  });
}
