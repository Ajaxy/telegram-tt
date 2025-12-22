import { PasskeyLoginRequestedError, UserAlreadyAuthorizedError } from '../../../lib/gramjs/errors';

import type {
  ApiPasskeyOption,
  ApiUpdateAuthorizationState,
  ApiUpdateAuthorizationStateType,
  ApiUser,
  ApiUserFullInfo,
} from '../../types';

import { wrapError } from '../helpers/misc';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';

const authController: {
  resolve?: AnyToVoidFunction;
  reject?: (error: Error) => void;
} = {};

export function onWebAuthTokenFailed() {
  sendApiUpdate({
    '@type': 'updateWebAuthTokenFailed',
  });
}

export function onPasskeyOption(option: ApiPasskeyOption) {
  sendApiUpdate({
    '@type': 'updatePasskeyOption',
    option,
  });
}

export function onRequestPhoneNumber() {
  sendApiUpdate(buildAuthStateUpdate('authorizationStateWaitPhoneNumber'));

  return new Promise<string>((resolve, reject) => {
    authController.resolve = resolve;
    authController.reject = reject;
  });
}

export function onRequestCode(isCodeViaApp = false) {
  sendApiUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitCode'),
    isCodeViaApp,
  });

  return new Promise<string>((resolve, reject) => {
    authController.resolve = resolve;
    authController.reject = reject;
  });
}

export function onRequestPassword(hint?: string, noReset?: boolean) {
  sendApiUpdate({
    ...buildAuthStateUpdate('authorizationStateWaitPassword'),
    hint,
    noReset,
  });

  return new Promise<string>((resolve) => {
    authController.resolve = resolve;
  });
}

export function onRequestRegistration() {
  sendApiUpdate(buildAuthStateUpdate('authorizationStateWaitRegistration'));

  return new Promise<[string, string?]>((resolve) => {
    authController.resolve = resolve;
  });
}

export function onRequestQrCode(qrCode: { token: Buffer; expires: number }) {
  sendApiUpdate({
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
  if (err instanceof UserAlreadyAuthorizedError) {
    sendApiUpdate({
      '@type': 'updateUserAlreadyAuthorized',
      userId: err.userId,
    });
    return;
  }

  const { messageKey, errorMessage } = wrapError(err);

  sendApiUpdate({
    '@type': 'updateAuthorizationError',
    errorKey: messageKey,
    errorCode: errorMessage,
  });
}

export function onAuthReady() {
  sendApiUpdate(buildAuthStateUpdate('authorizationStateReady'));
}

export function onCurrentUserUpdate(currentUser: ApiUser, currentUserFullInfo: ApiUserFullInfo) {
  sendApiUpdate({
    '@type': 'updateCurrentUser',
    currentUser,
    currentUserFullInfo,
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

export function restartAuthWithPasskey(credentialJson: PublicKeyCredentialJSON) {
  if (!authController.reject) {
    return;
  }

  authController.reject(new PasskeyLoginRequestedError(credentialJson));
}
