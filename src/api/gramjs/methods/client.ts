import {
  sessions, Api as GramJs, connection,
} from '../../../lib/gramjs';
import TelegramClient from '../../../lib/gramjs/client/TelegramClient';

import { Logger as GramJsLogger } from '../../../lib/gramjs/extensions/index';
import type { TwoFaParams } from '../../../lib/gramjs/client/2fa';

import type {
  ApiInitialArgs,
  ApiMediaFormat,
  ApiOnProgress,
  ApiSessionData,
  OnApiUpdate,
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
import downloadMediaWithClient, { parseMediaUrl } from './media';
import { buildApiUserFromFull } from '../apiBuilders/users';
import localDb, { clearLocalDb } from '../localDb';
import { buildApiPeerId } from '../apiBuilders/peers';
import { addMessageToLocalDb } from '../helpers';

const DEFAULT_USER_AGENT = 'Unknown UserAgent';
const DEFAULT_PLATFORM = 'Unknown platform';
const APP_CODE_NAME = 'Z';

GramJsLogger.setLevel(DEBUG_GRAMJS ? 'debug' : 'warn');

const gramJsUpdateEventBuilder = { build: (update: object) => update };

let onUpdate: OnApiUpdate;
let client: TelegramClient;
let isConnected = false;

export async function init(_onUpdate: OnApiUpdate, initialArgs: ApiInitialArgs) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START INIT API');
  }

  onUpdate = _onUpdate;

  const {
    userAgent, platform, sessionData, isTest, isMovSupported, isWebmSupported,
  } = initialArgs;
  const session = new sessions.CallbackSession(sessionData, onSessionUpdate);

  // eslint-disable-next-line no-restricted-globals
  (self as any).isMovSupported = isMovSupported;
  // eslint-disable-next-line no-restricted-globals
  (self as any).isWebmSupported = isWebmSupported;

  client = new TelegramClient(
    session,
    process.env.TELEGRAM_T_API_ID,
    process.env.TELEGRAM_T_API_HASH,
    {
      deviceModel: navigator.userAgent || userAgent || DEFAULT_USER_AGENT,
      systemVersion: platform || DEFAULT_PLATFORM,
      appVersion: `${APP_VERSION} ${APP_CODE_NAME}`,
      useWSS: true,
      additionalDcsDisabled: IS_TEST,
      testServers: isTest,
    } as any,
  );

  client.addEventHandler(handleGramJsUpdate, gramJsUpdateEventBuilder);
  client.addEventHandler(updater, gramJsUpdateEventBuilder);

  try {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[GramJs/client] CONNECTING');

      // eslint-disable-next-line no-restricted-globals
      (self as any).invoke = invokeRequest;
      // eslint-disable-next-line no-restricted-globals
      (self as any).GramJs = GramJs;
    }

    try {
      await client.start({
        phoneNumber: onRequestPhoneNumber,
        phoneCode: onRequestCode,
        password: onRequestPassword,
        firstAndLastNames: onRequestRegistration,
        qrCode: onRequestQrCode,
        onError: onAuthError,
        initialMethod: platform === 'iOS' || platform === 'Android' ? 'phoneNumber' : 'qrCode',
        shouldThrowIfUnauthorized: Boolean(sessionData),
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);

      if (err.message !== 'Disconnect' && err.message !== 'Cannot send requests while disconnected') {
        onUpdate({
          '@type': 'updateConnectionState',
          connectionState: 'connectionStateBroken',
        });

        return;
      }
    }

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('>>> FINISH INIT API');
      // eslint-disable-next-line no-console
      console.log('[GramJs/client] CONNECTED');
    }

    onAuthReady();
    onSessionUpdate(session.getSessionData());
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

export async function destroy(noLogOut = false) {
  if (!noLogOut) {
    await invokeRequest(new GramJs.auth.LogOut());
  }

  clearLocalDb();

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
  shouldReturnTrue: true,
  shouldThrow?: boolean,
  shouldIgnoreUpdates?: undefined,
  dcId?: number,
): Promise<true | undefined>;

export async function invokeRequest<T extends GramJs.AnyRequest>(
  request: T,
  shouldReturnTrue?: boolean,
  shouldThrow?: boolean,
  shouldIgnoreUpdates?: boolean,
  dcId?: number,
): Promise<T['__response'] | undefined>;

export async function invokeRequest<T extends GramJs.AnyRequest>(
  request: T,
  shouldReturnTrue = false,
  shouldThrow = false,
  shouldIgnoreUpdates = false,
  dcId?: number,
) {
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

    const result = await client.invoke(request, dcId);

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`[GramJs/client] INVOKE RESPONSE ${request.className}`, result);
    }

    if (!shouldIgnoreUpdates) {
      handleUpdatesFromRequest(request, result);
    }

    return shouldReturnTrue ? result && true : result;
  } catch (err: any) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`[GramJs/client] INVOKE ERROR ${request.className}`);
      // eslint-disable-next-line no-console
      console.error(err);
    }

    if (shouldThrow) {
      throw err;
    }

    dispatchErrorUpdate(err, request);

    return undefined;
  }
}

function handleUpdatesFromRequest<T extends GramJs.AnyRequest>(request: T, result: T['__response']) {
  let manyUpdates;
  let singleUpdate;

  if (result instanceof GramJs.UpdatesCombined || result instanceof GramJs.Updates) {
    manyUpdates = result;
  } else if (typeof result === 'object' && 'updates' in result && (
    result.updates instanceof GramJs.Updates || result.updates instanceof GramJs.UpdatesCombined
  )) {
    manyUpdates = result.updates;
  } else if (
    result instanceof GramJs.UpdateShortMessage
    || result instanceof GramJs.UpdateShortChatMessage
    || result instanceof GramJs.UpdateShort
    || result instanceof GramJs.UpdateShortSentMessage
  ) {
    singleUpdate = result;
  }

  if (manyUpdates) {
    injectUpdateEntities(manyUpdates);

    manyUpdates.updates.forEach((update) => {
      updater(update, request);
    });
  } else if (singleUpdate) {
    updater(singleUpdate, request);
  }
}

export function downloadMedia(
  args: { url: string; mediaFormat: ApiMediaFormat; start?: number; end?: number; isHtmlAllowed?: boolean },
  onProgress?: ApiOnProgress,
) {
  return downloadMediaWithClient(args, client, isConnected, onProgress).catch(async (err) => {
    if (err.message.startsWith('FILE_REFERENCE')) {
      const isFileReferenceRepaired = await repairFileReference({ url: args.url });
      if (!isFileReferenceRepaired) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('Failed to repair file reference', args.url);
        }
        return undefined;
      }

      return downloadMediaWithClient(args, client, isConnected, onProgress);
    }
    return undefined;
  });
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

  if (!userFull || !(userFull.users[0] instanceof GramJs.User)) {
    return;
  }

  const user = userFull.users[0];

  localDb.users[buildApiPeerId(user.id, 'user')] = user;
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
      hasErrorKey: true,
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
  } catch (err: any) {
    if (err.message === 'AUTH_KEY_UNREGISTERED') {
      onUpdate({
        '@type': 'updateConnectionState',
        connectionState: 'connectionStateBroken',
      });
    }
  }
}

export async function repairFileReference({
  url,
}: {
  url: string;
}) {
  const parsed = parseMediaUrl(url);

  if (!parsed) return undefined;

  const {
    entityType, entityId, mediaMatchType,
  } = parsed;

  if (mediaMatchType === 'file') {
    return false;
  }

  if (entityType === 'msg') {
    const entity = localDb.messages[entityId]!;
    const messageId = entity.id;

    const peer = 'channelId' in entity.peerId ? new GramJs.InputChannel({
      channelId: entity.peerId.channelId,
      accessHash: (localDb.chats[buildApiPeerId(entity.peerId.channelId, 'channel')] as GramJs.Channel).accessHash!,
    }) : undefined;
    const result = await invokeRequest(
      peer
        ? new GramJs.channels.GetMessages({
          channel: peer,
          id: [new GramJs.InputMessageID({ id: messageId })],
        })
        : new GramJs.messages.GetMessages({
          id: [new GramJs.InputMessageID({ id: messageId })],
        }),
    );

    if (!result || result instanceof GramJs.messages.MessagesNotModified) return false;

    const message = result.messages[0];
    if (message instanceof GramJs.MessageEmpty) return false;
    addMessageToLocalDb(message);
    return true;
  }

  return false;
}
