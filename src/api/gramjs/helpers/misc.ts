import { Api as GramJs, errors } from '../../../lib/gramjs';

import type { RegularLangKey } from '../../../types/language';
import type { RegularLangFnParameters } from '../../../util/localization';

import { DEBUG } from '../../../config';
import {
  DAY, getDays, getHours, getMinutes, HOUR, MINUTE,
} from '../../../util/dates/units';
import { getApiChatIdFromMtpPeer } from '../apiBuilders/peers';

const LOG_BACKGROUND = '#111111DD';
const LOG_PREFIX_COLOR = '#E4D00A';
const LOG_SUFFIX = {
  INVOKE: '#49DBF5',
  BEACON: '#F549DB',
  RESPONSE: '#6887F7',
  CONNECTING: '#E4D00A',
  CONNECTED: '#26D907',
  'CONNECTING ERROR': '#D1191C',
  'INVOKE ERROR': '#D1191C',
  UPDATE: '#0DD151',
  'UNEXPECTED UPDATE': '#9C9C9C',
  'UNEXPECTED RESPONSE': '#D1191C',
};

const ERROR_KEYS: Record<string, RegularLangKey> = {
  PHONE_NUMBER_INVALID: 'ErrorPhoneNumberInvalid',
  PHONE_CODE_INVALID: 'ErrorCodeInvalid',
  PASSWORD_HASH_INVALID: 'ErrorIncorrectPassword',
  PHONE_PASSWORD_FLOOD: 'ErrorPasswordFlood',
  PHONE_NUMBER_BANNED: 'ErrorPhoneBanned',
  EMAIL_UNCONFIRMED: 'ErrorEmailUnconfirmed',
  EMAIL_HASH_EXPIRED: 'ErrorEmailHashExpired',
  NEW_SALT_INVALID: 'ErrorNewSaltInvalid',
  SRP_PASSWORD_CHANGED: 'ErrorPasswordChanged',
  CODE_INVALID: 'ErrorEmailCodeInvalid',
  PASSWORD_MISSING: 'ErrorPasswordMissing',
  PASSKEY_CREDENTIAL_NOT_FOUND: 'ErrorPasskeyUnknown',
};

export type MessageRepairContext = Pick<GramJs.TypeMessage, 'peerId' | 'id'>;
export type MediaRepairContext = MessageRepairContext;

export type WrappedError<T extends Error = Error> = {
  messageKey: RegularLangFnParameters;
  errorMessage?: string;
  error: T;
};

export function resolveMessageApiChatId(mtpMessage: GramJs.TypeMessage) {
  if (!(mtpMessage instanceof GramJs.Message || mtpMessage instanceof GramJs.MessageService)) {
    return undefined;
  }

  return getApiChatIdFromMtpPeer(mtpMessage.peerId);
}

export function isChatFolder(
  filter?: GramJs.TypeDialogFilter,
): filter is GramJs.DialogFilter | GramJs.DialogFilterChatlist {
  return filter instanceof GramJs.DialogFilter || filter instanceof GramJs.DialogFilterChatlist;
}

export function serializeBytes(value: Buffer) {
  return String.fromCharCode(...value);
}

export function deserializeBytes(value: string) {
  return Buffer.from(value, 'binary');
}

export function log(suffix: keyof typeof LOG_SUFFIX, ...data: any) {
  /* eslint-disable @stylistic/max-len */
  /* eslint-disable no-console */
  const func = suffix === 'UNEXPECTED RESPONSE' ? console.error
    : suffix === 'INVOKE ERROR' || suffix === 'UNEXPECTED UPDATE' ? console.warn : console.log;
  /* eslint-enable no-console */
  func(
    `%cGramJS%c${suffix}`,
    `color: ${LOG_PREFIX_COLOR}; background: ${LOG_BACKGROUND}; padding: 0.25rem; border-radius: 0.25rem;`,
    `color: ${LOG_SUFFIX[suffix]}; background: ${LOG_BACKGROUND}; padding: 0.25rem; border-radius: 0.25rem; margin-left: 0.25rem;`,
    ...data,
  );
  /* eslint-enable @stylistic/max-len */
}

export function isResponseUpdate<T extends GramJs.AnyRequest>(result: T['__response']): result is GramJs.TypeUpdate {
  return result instanceof GramJs.UpdatesTooLong || result instanceof GramJs.UpdateShortMessage
    || result instanceof GramJs.UpdateShortChatMessage || result instanceof GramJs.UpdateShort
    || result instanceof GramJs.UpdatesCombined || result instanceof GramJs.Updates
    || result instanceof GramJs.UpdateShortSentMessage;
}

export function checkErrorType(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    // eslint-disable-next-line no-console
    if (DEBUG) console.warn('Unexpected error type', error);
    return false;
  }

  return true;
}

export function wrapError<T extends Error>(error: T): WrappedError<T> {
  let messageKey: RegularLangFnParameters | undefined;

  const errorMessage = error instanceof errors.RPCError ? error.errorMessage : undefined;

  if (error instanceof errors.FloodWaitError) {
    messageKey = {
      key: 'ErrorFloodTime',
      variables: { time: formatWait(error.seconds) },
    };
  } else if (error instanceof errors.PasswordFreshError) {
    messageKey = {
      key: 'ErrorPasswordFresh',
      variables: { time: formatWait(error.seconds) },
    };
  } else if (error instanceof errors.RPCError) {
    messageKey = {
      key: ERROR_KEYS[error.errorMessage],
    };
  }

  if (!messageKey) {
    if (error.message) {
      messageKey = {
        key: 'ErrorUnexpectedMessage',
        variables: { error: error.message },
      };
    } else {
      messageKey = {
        key: 'ErrorUnexpected',
      };
    }
  }

  return {
    messageKey,
    errorMessage,
    error,
  };
}

function formatWait(seconds: number): RegularLangFnParameters {
  if (seconds < MINUTE) {
    return {
      key: 'Seconds',
      variables: { count: seconds },
      options: { pluralValue: seconds },
    };
  }

  if (seconds < HOUR) {
    const minutes = getMinutes(seconds);
    return {
      key: 'Minutes',
      variables: { count: minutes },
      options: { pluralValue: minutes },
    };
  }

  if (seconds < DAY) {
    const hours = getHours(seconds);
    return {
      key: 'Hours',
      variables: { count: hours },
      options: { pluralValue: hours },
    };
  }

  const days = getDays(seconds);

  return {
    key: 'Days',
    variables: { count: days },
    options: { pluralValue: days },
  };
}
