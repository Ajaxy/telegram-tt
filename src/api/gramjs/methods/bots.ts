import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiThemeParameters, ApiUser, OnApiUpdate,
} from '../../types';

import localDb from '../localDb';
import { invokeRequest } from './client';
import { buildInputPeer, buildInputThemeParams, generateRandomBigInt } from '../gramjsBuilders';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildApiAttachBot, buildApiBotInlineMediaResult, buildApiBotInlineResult, buildBotSwitchPm,
} from '../apiBuilders/bots';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { addEntitiesWithPhotosToLocalDb, addUserToLocalDb, deserializeBytes } from '../helpers';
import { omitVirtualClassFields } from '../apiBuilders/helpers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { buildApiUrlAuthResult } from '../apiBuilders/misc';

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

  addEntitiesWithPhotosToLocalDb(result.users);

  return {
    isGallery: Boolean(result.gallery),
    help: bot.botPlaceholder,
    nextOffset: getInlineBotResultsNextOffset(bot.usernames![0].username, result.nextOffset),
    switchPm: buildBotSwitchPm(result.switchPm),
    users: result.users.map(buildApiUser).filter(Boolean),
    results: processInlineBotResult(String(result.queryId), result.results),
  };
}

export async function sendInlineBotResult({
  chat, resultId, queryId, replyingTo, sendAs, isSilent, scheduleDate,
}: {
  chat: ApiChat;
  resultId: string;
  queryId: string;
  replyingTo?: number;
  sendAs?: ApiUser | ApiChat;
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
    ...(isSilent && { silent: true }),
    ...(replyingTo && { replyToMsgId: replyingTo }),
    ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
  }), true);
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
  }), true);
}

export async function requestWebView({
  isSilent,
  peer,
  bot,
  url,
  startParam,
  replyToMessageId,
  theme,
  sendAs,
  isFromBotMenu,
}: {
  isSilent?: boolean;
  peer: ApiChat | ApiUser;
  bot: ApiUser;
  url?: string;
  startParam?: string;
  replyToMessageId?: number;
  theme?: ApiThemeParameters;
  sendAs?: ApiUser | ApiChat;
  isFromBotMenu?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestWebView({
    silent: isSilent || undefined,
    peer: buildInputPeer(peer.id, peer.accessHash),
    bot: buildInputPeer(bot.id, bot.accessHash),
    replyToMsgId: replyToMessageId,
    url,
    startParam,
    themeParams: theme ? buildInputThemeParams(theme) : undefined,
    fromBotMenu: isFromBotMenu || undefined,
    platform: 'webz',
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
  bot, url, theme,
}: {
  bot: ApiUser;
  url: string;
  theme?: ApiThemeParameters;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestSimpleWebView({
    url,
    bot: buildInputPeer(bot.id, bot.accessHash),
    themeParams: theme ? buildInputThemeParams(theme) : undefined,
    platform: 'webz',
  }));

  return result?.url;
}

export function prolongWebView({
  isSilent,
  peer,
  bot,
  queryId,
  replyToMessageId,
  sendAs,
}: {
  isSilent?: boolean;
  peer: ApiChat | ApiUser;
  bot: ApiUser;
  queryId: string;
  replyToMessageId?: number;
  sendAs?: ApiUser | ApiChat;
}) {
  return invokeRequest(new GramJs.messages.ProlongWebView({
    silent: isSilent || undefined,
    peer: buildInputPeer(peer.id, peer.accessHash),
    bot: buildInputPeer(bot.id, bot.accessHash),
    queryId: BigInt(queryId),
    replyToMsgId: replyToMessageId,
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
  }), true);
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
    addEntitiesWithPhotosToLocalDb(result.users);
    return {
      hash: result.hash.toString(),
      bots: buildCollectionByKey(result.bots.map(buildApiAttachBot), 'id'),
    };
  }
  return undefined;
}

export function toggleAttachBot({
  bot,
  isEnabled,
}: {
  bot: ApiUser;
  isEnabled: boolean;
}) {
  return invokeRequest(new GramJs.messages.ToggleBotInAttachMenu({
    bot: buildInputPeer(bot.id, bot.accessHash),
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
