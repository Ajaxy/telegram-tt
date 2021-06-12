import { errors } from '../../../lib/gramjs';
import {
  ApiUpdateAuthorizationState,
  ApiUpdateAuthorizationStateType,
  OnApiUpdate,
  ApiUser,
} from '../../types';

import { DEBUG } from '../../../config';

const ApiErrors: { [k: string]: string } = {
  PHONE_NUMBER_INVALID: 'Invalid Phone Number',
  PHONE_CODE_INVALID: 'Invalid Code',
  PASSWORD_HASH_INVALID: 'Invalid Password',
  PHONE_PASSWORD_FLOOD: 'You have tried logging in too many times',
};

const authController: {
  resolve?: Function;
  reject?: Function;
} = {};

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export function onRequestPhoneNumber() {
  onUpdate(buildAuthStateUpdate('authorizationStateWaitPhoneNumber'));

  return new Promise<string>((resolve, reject) => {
    authController.resolve = resolve;
    authController.reject = reject;
  });
}

export function onRequestCode(isCodeViaApp = false) {
  onUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitCode'),
    isCodeViaApp,
  });

  return new Promise<string>((resolve, reject) => {
    authController.resolve = resolve;
    authController.reject = reject;
  });
}

export function onRequestPassword(hint?: string) {
  onUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitPassword'),
    hint,
  });

  return new Promise<string>((resolve) => {
    authController.resolve = resolve;
  });
}

export function onRequestRegistration() {
  onUpdate(buildAuthStateUpdate('authorizationStateWaitRegistration'));

  return new Promise<[string, string?]>((resolve) => {
    authController.resolve = resolve;
  });
}

export function onRequestQrCode(qrCode: { token: Buffer; expires: number }) {
  onUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitQrCode'),
    qrCode: {
      token: btoa(String.fromCharCode(...qrCode.token)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      expires: qrCode.expires,
    },
  });

  return new Promise<void>((resolve, reject) => {
    authController.reject = reject;
  });
}

export function onAuthError(err: Error) {
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
    '@type': 'updateAuthorizationError',
    message,
  });
}

export function onAuthReady(sessionId: string, sessionJson: string) {
  onUpdate({
    ...buildAuthStateUpdate('authorizationStateReady'),
    sessionId,
    sessionJson,
  });
}

export function onCurrentUserUpdate(currentUser: ApiUser) {
  onUpdate({
    '@type': 'updateCurrentUser',
    currentUser,
  });
}

export function buildAuthStateUpdate(authorizationState: ApiUpdateAuthorizationStateType): ApiUpdateAuthorizationState {
  return {
    '@type': 'updateAuthorizationState',
    authorizationState,
  };
}

export function provideAuthPhoneNumber(phoneNumber: string) {
  if (!authController.resolve) {
    return;
  }

  authController.resolve(phoneNumber);
}

export function provideAuthCode(code: string) {
  if (!authController.resolve) {
    return;
  }

  authController.resolve(code);
}

export function provideAuthPassword(password: string) {
  if (!authController.resolve) {
    return;
  }

  authController.resolve(password);
}

export function provideAuthRegistration(registration: { firstName: string; lastName: string }) {
  const { firstName, lastName } = registration;

  if (!authController.resolve) {
    return;
  }

  authController.resolve([firstName, lastName]);
}

export function restartAuth() {
  if (!authController.reject) {
    return;
  }

  authController.reject(new Error('RESTART_AUTH'));
}

export function restartAuthWithQr() {
  if (!authController.reject) {
    return;
  }

  authController.reject(new Error('RESTART_AUTH_WITH_QR'));
}
