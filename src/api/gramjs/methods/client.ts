import {
  TelegramClient, sessions, Api as GramJs, connection,
} from '../../../lib/gramjs';
import { Logger as GramJsLogger } from '../../../lib/gramjs/extensions/index';
import { TwoFaParams } from '../../../lib/gramjs/client/2fa';

import {
  ApiMediaFormat, ApiOnProgress, ApiSessionData, OnApiUpdate,
} from '../../types';

import {
  DEBUG, DEBUG_GRAMJS, UPLOAD_WORKERS, IS_TEST, APP_VERSION,
} from '../../../config';
import {
  onRequestPhoneNumber, onRequestCode, onRequestPassword, onRequestRegistration,
  onAuthError, onAuthReady, onCurrentUserUpdate, onRequestQrCode,
} from './auth';
import { updater } from '../updater';
import { setMessageBuilderCurrentUserId } from '../apiBuilders/messages';
import downloadMediaWithClient from './media';
import { buildApiUserFromFull } from '../apiBuilders/users';
import localDb from '../localDb';

const DEFAULT_USER_AGENT = 'Unknown UserAgent';
const APP_CODE_NAME = 'Z';

GramJsLogger.setLevel(DEBUG_GRAMJS ? 'debug' : 'warn');

const gramJsUpdateEventBuilder = { build: (update: object) => update };

let onUpdate: OnApiUpdate;
let client: TelegramClient;
let isConnected = false;

export async function init(_onUpdate: OnApiUpdate, sessionData?: ApiSessionData) {
  onUpdate = _onUpdate;

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START INIT API');
  }

  client = new TelegramClient(
    new sessions.CallbackSession(sessionData, onSessionUpdate),
    process.env.TELEGRAM_T_API_ID,
    process.env.TELEGRAM_T_API_HASH,
    {
      deviceModel: navigator.userAgent || DEFAULT_USER_AGENT,
      appVersion: `${APP_VERSION} ${APP_CODE_NAME}`,
      useWSS: true,
      additionalDcsDisabled: IS_TEST,
    } as any,
  );

  client.addEventHandler(handleGramJsUpdate, gramJsUpdateEventBuilder);
  client.addEventHandler(updater, gramJsUpdateEventBuilder);

  try {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[GramJs/client] CONNECTING');
    }

    await client.start({
      phoneNumber: onRequestPhoneNumber,
      phoneCode: onRequestCode,
      password: onRequestPassword,
      firstAndLastNames: onRequestRegistration,
      qrCode: onRequestQrCode,
      onError: onAuthError,
      initialMethod: 'qrCode',
    });

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('>>> FINISH INIT API');
      // eslint-disable-next-line no-console
      console.log('[GramJs/client] CONNECTED');
    }

    onAuthReady();
    onUpdate({ '@type': 'updateApiReady' });

    void fetchCurrentUser();
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[GramJs/client] CONNECTING ERROR', err);
    }

    throw err;
  }
}

export async function destroy() {
  await invokeRequest(new GramJs.auth.LogOut());
  await client.destroy();
}

export async function disconnect() {
  await client.disconnect();
}

export function getClient() {
  return client;
}

function onSessionUpdate(sessionData: ApiSessionData) {
  onUpdate({
    '@type': 'updateSession',
    sessionData,
  });
}

function handleGramJsUpdate(update: any) {
  if (update instanceof connection.UpdateConnectionState) {
    isConnected = update.state === connection.UpdateConnectionState.connected;
  } else if (update instanceof GramJs.UpdatesTooLong) {
    void handleTerminatedSession();
  } else if (update instanceof connection.UpdateServerTimeOffset) {
    onUpdate({
      '@type': 'updateServerTimeOffset',
      serverTimeOffset: update.timeOffset,
    });
  }
}

export async function invokeRequest<T extends GramJs.AnyRequest>(
  request: T,
  shouldHandleUpdates = false,
  shouldThrow = false,
): Promise<T['__response'] | undefined> {
  if (!isConnected) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(`[GramJs/client] INVOKE ERROR ${request.className}: Client is not connected`);
    }

    return undefined;
  }

  try {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`[GramJs/client] INVOKE ${request.className}`);
    }

    const result = await client.invoke(request);

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`[GramJs/client] INVOKE RESPONSE ${request.className}`, result);
    }

    if (shouldHandleUpdates) {
      type ResultWithUpdates = typeof result & { updates?: GramJs.Updates | GramJs.UpdatesCombined };

      let updatesContainer;
      if (result instanceof GramJs.Updates || result instanceof GramJs.UpdatesCombined) {
        updatesContainer = result;
      } else if ('updates' in result && (
        (result as ResultWithUpdates).updates instanceof GramJs.Updates
        || (result as ResultWithUpdates).updates instanceof GramJs.UpdatesCombined
      )) {
        updatesContainer = (result as ResultWithUpdates).updates;
      }

      if (updatesContainer) {
        injectUpdateEntities(updatesContainer);

        updatesContainer.updates.forEach((update) => {
          updater(update, request);
        });
      } else if (result instanceof GramJs.UpdatesTooLong) {
        // TODO Implement
      } else {
        updater(result as GramJs.TypeUpdates, request);
      }
    }

    return result;
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`[GramJs/client] INVOKE ERROR ${request.className}`);
      // eslint-disable-next-line no-console
      console.error(err);
    }

    dispatchErrorUpdate(err, request);

    if (shouldThrow) {
      throw err;
    }

    return undefined;
  }
}

export function downloadMedia(
  args: { url: string; mediaFormat: ApiMediaFormat; start?: number; end?: number },
  onProgress?: ApiOnProgress,
) {
  return downloadMediaWithClient(args, client, isConnected, onProgress);
}

export function uploadFile(file: File, onProgress?: ApiOnProgress) {
  return client.uploadFile({ file, onProgress, workers: UPLOAD_WORKERS });
}

export function updateTwoFaSettings(params: TwoFaParams) {
  return client.updateTwoFaSettings(params);
}

export async function fetchCurrentUser() {
  const userFull = await invokeRequest(new GramJs.users.GetFullUser({
    id: new GramJs.InputUserSelf(),
  }));

  if (!userFull || !(userFull.user instanceof GramJs.User)) {
    return;
  }

  localDb.users[userFull.user.id] = userFull.user;
  const currentUser = buildApiUserFromFull(userFull);

  setMessageBuilderCurrentUserId(currentUser.id);
  onCurrentUserUpdate(currentUser);
}

export function dispatchErrorUpdate<T extends GramJs.AnyRequest>(err: Error, request: T) {
  const isSlowMode = err.message.startsWith('A wait of') && (
    request instanceof GramJs.messages.SendMessage
    || request instanceof GramJs.messages.SendMedia
    || request instanceof GramJs.messages.SendMultiMedia
  );

  const { message } = err;

  onUpdate({
    '@type': 'error',
    error: {
      message,
      isSlowMode,
    },
  });
}

function injectUpdateEntities(result: GramJs.Updates | GramJs.UpdatesCombined) {
  const entities = [...result.users, ...result.chats];

  result.updates.forEach((update) => {
    if (entities) {
      // eslint-disable-next-line no-underscore-dangle
      (update as any)._entities = entities;
    }
  });
}

async function handleTerminatedSession() {
  try {
    await invokeRequest(new GramJs.users.GetFullUser({
      id: new GramJs.InputUserSelf(),
    }), undefined, true);
  } catch (err) {
    if (err.message === 'AUTH_KEY_UNREGISTERED') {
      onUpdate({
        '@type': 'updateConnectionState',
        connectionState: 'connectionStateBroken',
      });
    }
  }
}
