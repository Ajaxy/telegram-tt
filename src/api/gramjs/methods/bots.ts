import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiBotApp,
  ApiChat, ApiPeer, ApiThemeParameters, ApiUser, OnApiUpdate,
} from '../../types';

import { WEB_APP_PLATFORM } from '../../../config';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  buildApiAttachBot,
  buildApiBotApp,
  buildApiBotInlineMediaResult,
  buildApiBotInlineResult,
  buildBotSwitchPm,
  buildBotSwitchWebview,
} from '../apiBuilders/bots';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { omitVirtualClassFields } from '../apiBuilders/helpers';
import { buildApiUrlAuthResult } from '../apiBuilders/misc';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildInputBotApp,
  buildInputEntity,
  buildInputPeer,
  buildInputReplyToMessage,
  buildInputThemeParams,
  generateRandomBigInt,
} from '../gramjsBuilders';
import { addEntitiesToLocalDb, addUserToLocalDb, deserializeBytes } from '../helpers';
import localDb from '../localDb';
import { invokeRequest } from './client';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function answerCallbackButton({
  chatId, accessHash, messageId, data, isGame,
}: {
  chatId: string; accessHash?: string; messageId: number; data?: string; isGame?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.GetBotCallbackAnswer({
    peer: buildInputPeer(chatId, accessHash),
    msgId: messageId,
    data: data ? deserializeBytes(data) : undefined,
    game: isGame || undefined,
  }));

  return result ? omitVirtualClassFields(result) : undefined;
}

export async function fetchTopInlineBots() {
  const topPeers = await invokeRequest(new GramJs.contacts.GetTopPeers({
    botsInline: true,
  }));

  if (!(topPeers instanceof GramJs.contacts.TopPeers)) {
    return undefined;
  }

  const users = topPeers.users.map(buildApiUser).filter(Boolean);
  const ids = users.map(({ id }) => id);

  return {
    ids,
    users,
  };
}

export async function fetchInlineBot({ username }: { username: string }) {
  const resolvedPeer = await invokeRequest(new GramJs.contacts.ResolveUsername({ username }));

  if (
    !resolvedPeer
    || !(
      resolvedPeer.users[0] instanceof GramJs.User
      && resolvedPeer.users[0].bot
      && resolvedPeer.users[0].botInlinePlaceholder
    )
  ) {
    return undefined;
  }

  addUserToLocalDb(resolvedPeer.users[0]);

  return {
    user: buildApiUser(resolvedPeer.users[0]),
    chat: buildApiChatFromPreview(resolvedPeer.users[0]),
  };
}

export async function fetchInlineBotResults({
  bot, chat, query, offset = '',
}: {
  bot: ApiUser; chat: ApiChat; query: string; offset?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.GetInlineBotResults({
    bot: buildInputPeer(bot.id, bot.accessHash),
    peer: buildInputPeer(chat.id, chat.accessHash),
    query,
    offset,
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);

  return {
    isGallery: Boolean(result.gallery),
    help: bot.botPlaceholder,
    nextOffset: getInlineBotResultsNextOffset(bot.usernames![0].username, result.nextOffset),
    switchPm: buildBotSwitchPm(result.switchPm),
    switchWebview: buildBotSwitchWebview(result.switchWebview),
    users: result.users.map(buildApiUser).filter(Boolean),
    results: processInlineBotResult(String(result.queryId), result.results),
    cacheTime: result.cacheTime,
  };
}

export async function sendInlineBotResult({
  chat, replyingToTopId, resultId, queryId, replyingTo, sendAs, isSilent, scheduleDate,
}: {
  chat: ApiChat;
  replyingToTopId?: number;
  resultId: string;
  queryId: string;
  replyingTo?: number;
  sendAs?: ApiPeer;
  isSilent?: boolean;
  scheduleDate?: number;
}) {
  const randomId = generateRandomBigInt();

  await invokeRequest(new GramJs.messages.SendInlineBotResult({
    clearDraft: true,
    randomId,
    queryId: BigInt(queryId),
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: resultId,
    scheduleDate,
    ...(replyingToTopId && { topMsgId: replyingToTopId }),
    ...(isSilent && { silent: true }),
    ...(replyingTo && { replyToMsgId: replyingTo }),
    ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
  }));
}

export async function startBot({
  bot, startParam,
}: {
  bot: ApiUser;
  startParam?: string;
}) {
  const randomId = generateRandomBigInt();

  await invokeRequest(new GramJs.messages.StartBot({
    bot: buildInputPeer(bot.id, bot.accessHash),
    peer: buildInputPeer(bot.id, bot.accessHash),
    randomId,
    startParam,
  }));
}

export async function requestWebView({
  isSilent,
  peer,
  bot,
  url,
  startParam,
  replyToMessageId,
  threadId,
  theme,
  sendAs,
  isFromBotMenu,
}: {
  isSilent?: boolean;
  peer: ApiPeer;
  bot: ApiUser;
  url?: string;
  startParam?: string;
  replyToMessageId?: number;
  threadId?: number;
  theme?: ApiThemeParameters;
  sendAs?: ApiPeer;
  isFromBotMenu?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestWebView({
    silent: isSilent || undefined,
    peer: buildInputPeer(peer.id, peer.accessHash),
    bot: buildInputPeer(bot.id, bot.accessHash),
    url,
    startParam,
    themeParams: theme ? buildInputThemeParams(theme) : undefined,
    fromBotMenu: isFromBotMenu || undefined,
    platform: WEB_APP_PLATFORM,
    ...(replyToMessageId && { replyTo: buildInputReplyToMessage(replyToMessageId, threadId) }),
    ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
  }));

  if (result instanceof GramJs.WebViewResultUrl) {
    return {
      url: result.url,
      queryId: result.queryId.toString(),
    };
  }

  return undefined;
}

export async function requestSimpleWebView({
  bot,
  url,
  theme,
  startParam,
  isFromSwitchWebView,
  isFromSideMenu,
}: {
  bot: ApiUser;
  url?: string;
  theme?: ApiThemeParameters;
  startParam?: string;
  isFromSwitchWebView?: boolean;
  isFromSideMenu?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestSimpleWebView({
    url,
    bot: buildInputPeer(bot.id, bot.accessHash),
    themeParams: theme ? buildInputThemeParams(theme) : undefined,
    platform: WEB_APP_PLATFORM,
    startParam,
    fromSwitchWebview: isFromSwitchWebView || undefined,
    fromSideMenu: isFromSideMenu || undefined,
  }));

  return result?.url;
}

export async function fetchBotApp({
  bot,
  appName,
}: {
  bot: ApiUser;
  appName: string;
}) {
  const result = await invokeRequest(new GramJs.messages.GetBotApp({
    app: new GramJs.InputBotAppShortName({
      botId: buildInputEntity(bot.id, bot.accessHash) as GramJs.InputUser,
      shortName: appName,
    }),
  }));

  if (!result || result instanceof GramJs.BotAppNotModified) {
    return undefined;
  }

  return buildApiBotApp(result);
}

export async function requestAppWebView({
  peer,
  app,
  startParam,
  theme,
  isWriteAllowed,
}: {
  peer: ApiPeer;
  app: ApiBotApp;
  startParam?: string;
  theme?: ApiThemeParameters;
  isWriteAllowed?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestAppWebView({
    peer: buildInputPeer(peer.id, peer.accessHash),
    app: buildInputBotApp(app),
    startParam,
    themeParams: theme ? buildInputThemeParams(theme) : undefined,
    platform: WEB_APP_PLATFORM,
    writeAllowed: isWriteAllowed || undefined,
  }));

  return result?.url;
}

export function prolongWebView({
  isSilent,
  peer,
  bot,
  queryId,
  replyToMessageId,
  threadId,
  sendAs,
}: {
  isSilent?: boolean;
  peer: ApiPeer;
  bot: ApiUser;
  queryId: string;
  replyToMessageId?: number;
  threadId?: number;
  sendAs?: ApiPeer;
}) {
  return invokeRequest(new GramJs.messages.ProlongWebView({
    silent: isSilent || undefined,
    peer: buildInputPeer(peer.id, peer.accessHash),
    bot: buildInputPeer(bot.id, bot.accessHash),
    queryId: BigInt(queryId),
    ...(replyToMessageId && { replyTo: buildInputReplyToMessage(replyToMessageId, threadId) }),
    ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
  }));
}

export async function sendWebViewData({
  bot, buttonText, data,
}: {
  bot: ApiUser;
  buttonText: string;
  data: string;
}) {
  const randomId = generateRandomBigInt();
  await invokeRequest(new GramJs.messages.SendWebViewData({
    bot: buildInputPeer(bot.id, bot.accessHash),
    buttonText,
    data,
    randomId,
  }));
}

export async function loadAttachBots({
  hash,
}: {
  hash?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.GetAttachMenuBots({
    hash: hash ? BigInt(hash) : undefined,
  }));

  if (result instanceof GramJs.AttachMenuBots) {
    addEntitiesToLocalDb(result.users);
    return {
      hash: result.hash.toString(),
      bots: buildCollectionByKey(result.bots.map(buildApiAttachBot), 'id'),
      users: result.users.map(buildApiUser).filter(Boolean),
    };
  }
  return undefined;
}

export async function loadAttachBot({
  bot,
}: {
  bot: ApiUser;
}) {
  const result = await invokeRequest(new GramJs.messages.GetAttachMenuBot({
    bot: buildInputPeer(bot.id, bot.accessHash),
  }));

  if (result instanceof GramJs.AttachMenuBotsBot) {
    addEntitiesToLocalDb(result.users);
    return {
      bot: buildApiAttachBot(result.bot),
      users: result.users.map(buildApiUser).filter(Boolean),
    };
  }
  return undefined;
}

export function toggleAttachBot({
  bot,
  isWriteAllowed,
  isEnabled,
}: {
  bot: ApiUser;
  isWriteAllowed?: boolean;
  isEnabled: boolean;
}) {
  return invokeRequest(new GramJs.messages.ToggleBotInAttachMenu({
    bot: buildInputPeer(bot.id, bot.accessHash),
    writeAllowed: isWriteAllowed || undefined,
    enabled: isEnabled,
  }));
}

export async function requestBotUrlAuth({
  chat, buttonId, messageId,
}: {
  chat: ApiChat;
  buttonId: number;
  messageId: number;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestUrlAuth({
    peer: buildInputPeer(chat.id, chat.accessHash),
    buttonId,
    msgId: messageId,
  }));

  if (!result) return undefined;

  const authResult = buildApiUrlAuthResult(result);
  if (authResult?.type === 'request') {
    onUpdate({
      '@type': 'updateUser',
      id: authResult.bot.id,
      user: authResult.bot,
    });
  }
  return authResult;
}

export async function acceptBotUrlAuth({
  chat,
  messageId,
  buttonId,
  isWriteAllowed,
}: {
  chat: ApiChat;
  messageId: number;
  buttonId: number;
  isWriteAllowed?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.AcceptUrlAuth({
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
    buttonId,
    writeAllowed: isWriteAllowed || undefined,
  }));

  if (!result) return undefined;

  const authResult = buildApiUrlAuthResult(result);
  if (authResult?.type === 'request') {
    onUpdate({
      '@type': 'updateUser',
      id: authResult.bot.id,
      user: authResult.bot,
    });
  }
  return authResult;
}

export async function requestLinkUrlAuth({ url }: { url: string }) {
  const result = await invokeRequest(new GramJs.messages.RequestUrlAuth({
    url,
  }));

  if (!result) return undefined;

  const authResult = buildApiUrlAuthResult(result);
  if (authResult?.type === 'request') {
    onUpdate({
      '@type': 'updateUser',
      id: authResult.bot.id,
      user: authResult.bot,
    });
  }
  return authResult;
}

export async function acceptLinkUrlAuth({ url, isWriteAllowed }: { url: string; isWriteAllowed?: boolean }) {
  const result = await invokeRequest(new GramJs.messages.AcceptUrlAuth({
    url,
    writeAllowed: isWriteAllowed || undefined,
  }));

  if (!result) return undefined;

  const authResult = buildApiUrlAuthResult(result);
  if (authResult?.type === 'request') {
    onUpdate({
      '@type': 'updateUser',
      id: authResult.bot.id,
      user: authResult.bot,
    });
  }
  return authResult;
}

export function fetchBotCanSendMessage({ bot } : { bot: ApiUser }) {
  return invokeRequest(new GramJs.bots.CanSendMessage({
    bot: buildInputEntity(bot.id, bot.accessHash) as GramJs.InputUser,
  }));
}

export function allowBotSendMessages({ bot } : { bot: ApiUser }) {
  return invokeRequest(new GramJs.bots.AllowSendMessage({
    bot: buildInputEntity(bot.id, bot.accessHash) as GramJs.InputUser,
  }), {
    shouldReturnTrue: true,
  });
}

export async function invokeWebViewCustomMethod({
  bot,
  customMethod,
  parameters,
}: {
  bot: ApiUser;
  customMethod: string;
  parameters: string;
}): Promise<{
    result: object;
  } | {
    error: string;
  }> {
  try {
    const result = await invokeRequest(new GramJs.bots.InvokeWebViewCustomMethod({
      bot: buildInputPeer(bot.id, bot.accessHash),
      params: new GramJs.DataJSON({
        data: parameters,
      }),
      customMethod,
    }), {
      shouldThrow: true,
    });

    return {
      result: JSON.parse(result!.data),
    };
  } catch (e) {
    const error = e as Error;
    return {
      error: error.message,
    };
  }
}

function processInlineBotResult(queryId: string, results: GramJs.TypeBotInlineResult[]) {
  return results.map((result) => {
    if (result instanceof GramJs.BotInlineMediaResult) {
      if (result.document instanceof GramJs.Document) {
        addDocumentToLocalDb(result.document);
      }

      if (result.photo instanceof GramJs.Photo) {
        addPhotoToLocalDb(result.photo);
      }

      return buildApiBotInlineMediaResult(result, queryId);
    }

    if (result.thumb) {
      addWebDocumentToLocalDb(result.thumb);
    }

    return buildApiBotInlineResult(result, queryId);
  });
}

function getInlineBotResultsNextOffset(username: string, nextOffset?: string) {
  return username === 'gif' && nextOffset === '0' ? '' : nextOffset;
}

function addDocumentToLocalDb(document: GramJs.Document) {
  localDb.documents[String(document.id)] = document;
}

function addPhotoToLocalDb(photo: GramJs.Photo) {
  localDb.photos[String(photo.id)] = photo;
}

function addWebDocumentToLocalDb(webDocument: GramJs.TypeWebDocument) {
  localDb.webDocuments[webDocument.url] = webDocument;
}
