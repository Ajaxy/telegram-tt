import { Api as GramJs, errors } from '../../../lib/gramjs';

import type { OnApiUpdate } from '../../types';

import { DEBUG } from '../../../config';
import { invokeRequest, updateTwoFaSettings } from './client';

const ApiErrors: { [k: string]: string } = {
  EMAIL_UNCONFIRMED: 'Email unconfirmed',
  EMAIL_HASH_EXPIRED: 'Email hash expired',
  NEW_SALT_INVALID: 'The new salt is invalid',
  NEW_SETTINGS_INVALID: 'The new password settings are invalid',
  CODE_INVALID: 'Invalid Code',
  PASSWORD_HASH_INVALID: 'Invalid Password',
};

const emailCodeController: {
  resolve?: Function;
  reject?: Function;
} = {};

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function getPasswordInfo() {
  const result = await invokeRequest(new GramJs.account.GetPassword());
  if (!result) {
    return undefined;
  }

  const { hint, hasPassword } = result;

  return { hint, hasPassword };
}

function onRequestEmailCode(length: number) {
  onUpdate({
    '@type': 'updateTwoFaStateWaitCode',
    length,
  });

  return new Promise<string>((resolve, reject) => {
    emailCodeController.resolve = resolve;
    emailCodeController.reject = reject;
  });
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
  let message: string;

  if (err instanceof errors.FloodWaitError) {
    const hours = Math.ceil(Number(err.seconds) / 60 / 60);
    message = `Too many attempts. Try again in ${hours > 1 ? `${hours} hours` : 'an hour'}`;
  } else {
    message = ApiErrors[err.message];
  }

  if (!message) {
    message = 'Unexpected Error';

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  onUpdate({
    '@type': 'updateTwoFaError',
    message,
  });
}
