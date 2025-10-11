import { Api as GramJs } from '../../../lib/gramjs';
import { generateRandomBigInt } from '../../../lib/gramjs/Helpers';

import type {
  ApiBotApp,
  ApiBotPreviewMedia,
  ApiChat,
  ApiInputMessageReplyInfo,
  ApiPeer,
  ApiThemeParameters,
  ApiUser,
} from '../../types';

import { WEB_APP_PLATFORM } from '../../../config';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  buildApiAttachBot,
  buildApiBotInlineMediaResult,
  buildApiBotInlineResult,
  buildApiMessagesBotApp,
  buildBotSwitchPm,
  buildBotSwitchWebview,
} from '../apiBuilders/bots';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { omitVirtualClassFields } from '../apiBuilders/helpers';
import { buildMessageMediaContent } from '../apiBuilders/messageContent';
import { buildApiUrlAuthResult } from '../apiBuilders/misc';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildInputBotApp,
  buildInputPeer,
  buildInputReplyTo,
  buildInputThemeParams,
  buildInputUser,
  DEFAULT_PRIMITIVES,
} from '../gramjsBuilders';
import {
  addDocumentToLocalDb,
  addPhotoToLocalDb,
  addUserToLocalDb,
  addWebDocumentToLocalDb,
} from '../helpers/localDb';
import { deserializeBytes } from '../helpers/misc';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import { invokeRequest } from './client';

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
    limit: DEFAULT_PRIMITIVES.INT,
    offset: DEFAULT_PRIMITIVES.INT,
    hash: DEFAULT_PRIMITIVES.BIGINT,
  }));

  if (!(topPeers instanceof GramJs.contacts.TopPeers)) {
    return undefined;
  }

  const users = topPeers.users.map(buildApiUser).filter(Boolean);
  const ids = users.map(({ id }) => id);

  return {
    ids,
  };
}

export async function fetchTopBotApps() {
  const topPeers = await invokeRequest(new GramJs.contacts.GetTopPeers({
    botsApp: true,
    limit: DEFAULT_PRIMITIVES.INT,
    offset: DEFAULT_PRIMITIVES.INT,
    hash: DEFAULT_PRIMITIVES.BIGINT,
  }));

  if (!(topPeers instanceof GramJs.contacts.TopPeers)) {
    return undefined;
  }

  const users = topPeers.users.map(buildApiUser).filter(Boolean);
  const ids = users.map(({ id }) => id);

  return {
    ids,
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
  bot, chat, query, offset = DEFAULT_PRIMITIVES.STRING,
}: {
  bot: ApiUser; chat: ApiChat; query: string; offset?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.GetInlineBotResults({
    bot: buildInputUser(bot.id, bot.accessHash),
    peer: buildInputPeer(chat.id, chat.accessHash),
    query,
    offset,
  }));

  if (!result) {
    return undefined;
  }

  return {
    isGallery: Boolean(result.gallery),
    help: bot.botPlaceholder,
    nextOffset: getInlineBotResultsNextOffset(bot.usernames![0].username, result.nextOffset),
    switchPm: buildBotSwitchPm(result.switchPm),
    switchWebview: buildBotSwitchWebview(result.switchWebview),
    results: processInlineBotResult(String(result.queryId), result.results),
    cacheTime: result.cacheTime,
  };
}

export async function sendInlineBotResult({
  chat, replyInfo, resultId, queryId, sendAs, isSilent, scheduleDate, allowPaidStars,
}: {
  chat: ApiChat;
  replyInfo?: ApiInputMessageReplyInfo;
  resultId: string;
  queryId: string;
  sendAs?: ApiPeer;
  isSilent?: boolean;
  scheduleDate?: number;
  allowPaidStars?: number;
}) {
  const randomId = generateRandomBigInt();

  await invokeRequest(new GramJs.messages.SendInlineBotResult({
    clearDraft: true,
    randomId,
    queryId: BigInt(queryId),
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: resultId,
    scheduleDate,
    replyTo: replyInfo && buildInputReplyTo(replyInfo),
    ...(isSilent && { silent: true }),
    ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
    ...(allowPaidStars && { allowPaidStars: BigInt(allowPaidStars) }),
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
    bot: buildInputUser(bot.id, bot.accessHash),
    peer: buildInputPeer(bot.id, bot.accessHash),
    randomId,
    startParam: startParam ?? DEFAULT_PRIMITIVES.STRING,
  }));
}

export async function requestWebView({
  isSilent,
  peer,
  bot,
  url,
  startParam,
  replyInfo,
  theme,
  sendAs,
  isFromBotMenu,
  isFullscreen,
}: {
  isSilent?: boolean;
  peer: ApiPeer;
  bot: ApiUser;
  url?: string;
  startParam?: string;
  replyInfo?: ApiInputMessageReplyInfo;
  theme?: ApiThemeParameters;
  sendAs?: ApiPeer;
  isFromBotMenu?: boolean;
  isFullscreen?: boolean;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestWebView({
    silent: isSilent || undefined,
    peer: buildInputPeer(peer.id, peer.accessHash),
    bot: buildInputUser(bot.id, bot.accessHash),
    url,
    startParam,
    themeParams: theme ? buildInputThemeParams(theme) : undefined,
    fromBotMenu: isFromBotMenu || undefined,
    platform: WEB_APP_PLATFORM,
    replyTo: replyInfo && buildInputReplyTo(replyInfo),
    fullscreen: isFullscreen ? true : undefined,
    ...(sendAs && { sendAs: buildInputPeer(sendAs.id, sendAs.accessHash) }),
  }));

  if (result instanceof GramJs.WebViewResultUrl) {
    return {
      url: result.url,
      queryId: result.queryId?.toString(),
      isFullScreen: Boolean(result.fullscreen),
    };
  }

  return undefined;
}

export async function requestMainWebView({
  peer,
  bot,
  startParam,
  mode,
  theme,
}: {
  peer: ApiPeer;
  bot: ApiUser;
  startParam?: string;
  mode?: string;
  theme?: ApiThemeParameters;
}) {
  const result = await invokeRequest(new GramJs.messages.RequestMainWebView({
    peer: buildInputPeer(peer.id, peer.accessHash),
    bot: buildInputUser(bot.id, bot.accessHash),
    startParam,
    fullscreen: mode === 'fullscreen' || undefined,
    themeParams: theme ? buildInputThemeParams(theme) : undefined,
    platform: WEB_APP_PLATFORM,
  }));

  if (!(result instanceof GramJs.WebViewResultUrl)) {
    return undefined;
  }

  return {
    url: result.url,
    queryId: result.queryId?.toString(),
    isFullscreen: Boolean(result.fullscreen),
  };
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
    bot: buildInputUser(bot.id, bot.accessHash),
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
      botId: buildInputUser(bot.id, bot.accessHash),
      shortName: appName,
    }),
    hash: DEFAULT_PRIMITIVES.BIGINT,
  }));

  if (!result || result instanceof GramJs.BotAppNotModified) {
    return undefined;
  }

  return buildApiMessagesBotApp(result);
}

export async function requestAppWebView({
  peer,
  app,
  startParam,
  mode,
  theme,
  isWriteAllowed,
}: {
  peer: ApiPeer;
  app: ApiBotApp;
  startParam?: string;
  mode?: string;
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
    fullscreen: mode === 'fullscreen' || undefined,
  }));

  return { url: result?.url, isFullscreen: Boolean(result?.fullscreen) };
}

export function prolongWebView({
  isSilent,
  peer,
  bot,
  queryId,
  replyInfo,
  sendAs,
}: {
  isSilent?: boolean;
  peer: ApiPeer;
  bot: ApiUser;
  queryId: string;
  replyInfo?: ApiInputMessageReplyInfo;
  sendAs?: ApiPeer;
}) {
  return invokeRequest(new GramJs.messages.ProlongWebView({
    silent: isSilent || undefined,
    peer: buildInputPeer(peer.id, peer.accessHash),
    bot: buildInputUser(bot.id, bot.accessHash),
    queryId: BigInt(queryId),
    replyTo: replyInfo && buildInputReplyTo(replyInfo),
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
    bot: buildInputUser(bot.id, bot.accessHash),
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
    hash: hash ? BigInt(hash) : DEFAULT_PRIMITIVES.BIGINT,
  }));

  if (result instanceof GramJs.AttachMenuBots) {
    return {
      hash: result.hash.toString(),
      bots: buildCollectionByKey(result.bots.map(buildApiAttachBot), 'id'),
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
    bot: buildInputUser(bot.id, bot.accessHash),
  }));

  if (result instanceof GramJs.AttachMenuBotsBot) {
    return {
      bot: buildApiAttachBot(result.bot),
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
    bot: buildInputUser(bot.id, bot.accessHash),
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
    sendApiUpdate({
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
    sendApiUpdate({
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
    sendApiUpdate({
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
    sendApiUpdate({
      '@type': 'updateUser',
      id: authResult.bot.id,
      user: authResult.bot,
    });
  }
  return authResult;
}

export function fetchBotCanSendMessage({ bot }: { bot: ApiUser }) {
  return invokeRequest(new GramJs.bots.CanSendMessage({
    bot: buildInputUser(bot.id, bot.accessHash),
  }));
}

export function allowBotSendMessages({ bot }: { bot: ApiUser }) {
  return invokeRequest(new GramJs.bots.AllowSendMessage({
    bot: buildInputUser(bot.id, bot.accessHash),
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
      bot: buildInputUser(bot.id, bot.accessHash),
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

export async function fetchPreviewMedias({ bot }: { bot: ApiUser }) {
  const result = await invokeRequest(new GramJs.bots.GetPreviewMedias({
    bot: buildInputUser(bot.id, bot.accessHash),
  }));

  if (!result) return undefined;

  const previews: ApiBotPreviewMedia[] = result.map((preview) => {
    return {
      content: buildMessageMediaContent(preview.media)!,
      date: preview.date,
    };
  });
  return previews;
}

export function checkBotDownloadFileParams({
  bot,
  fileName,
  url,
}: {
  bot: ApiUser;
  fileName: string;
  url: string;
}) {
  return invokeRequest(new GramJs.bots.CheckDownloadFileParams({
    bot: buildInputUser(bot.id, bot.accessHash),
    fileName,
    url,
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleUserEmojiStatusPermission({ bot, isEnabled }: { bot: ApiUser; isEnabled: boolean }) {
  return invokeRequest(new GramJs.bots.ToggleUserEmojiStatusPermission({
    bot: buildInputUser(bot.id, bot.accessHash),
    enabled: isEnabled,
  }), {
    shouldReturnTrue: true,
  });
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

export function setBotInfo({
  bot,
  langCode,
  name,
  about,
  description,
}: {
  bot: ApiUser;
  langCode: string;
  name?: string;
  about?: string;
  description?: string;
}) {
  return invokeRequest(new GramJs.bots.SetBotInfo({
    bot: buildInputUser(bot.id, bot.accessHash),
    langCode,
    name,
    about,
    description,
  }), {
    shouldReturnTrue: true,
  });
}

export async function fetchPopularAppBots({
  offset = DEFAULT_PRIMITIVES.STRING, limit,
}: {
  offset?: string;
  limit?: number;
}) {
  const result = await invokeRequest(new GramJs.bots.GetPopularAppBots({
    offset,
    limit: limit ?? DEFAULT_PRIMITIVES.INT,
  }));

  if (!result) {
    return undefined;
  }

  const users = result.users.map(buildApiUser).filter(Boolean);
  const peerIds = users.map(({ id }) => id);

  return {
    peerIds,
    nextOffset: result.nextOffset,
  };
}

export async function fetchBotsRecommendations({ user }: { user: ApiChat }) {
  if (!user) return undefined;
  const inputUser = buildInputUser(user.id, user.accessHash);
  const result = await invokeRequest(new GramJs.bots.GetBotRecommendations({
    bot: inputUser,
  }));
  if (!result) {
    return undefined;
  }

  const similarBots = result?.users.map(buildApiUser).filter(Boolean);

  return {
    similarBots,
    count: result instanceof GramJs.users.UsersSlice ? result.count : similarBots.length,
  };
}
