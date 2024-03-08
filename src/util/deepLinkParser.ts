import type { ThreadId } from '../types';

import { RE_TG_LINK, RE_TME_LINK } from '../config';
import { ensureProtocol } from './ensureProtocol';
import { isUsernameValid } from './username';

export type DeepLinkMethod = 'resolve' | 'login' | 'passport' | 'settings' | 'join' | 'addstickers' | 'addemoji' |
'setlanguage' | 'addtheme' | 'confirmphone' | 'socks' | 'proxy' | 'privatepost' | 'bg' | 'share' | 'msg' | 'msg_url' |
'invoice' | 'addlist' | 'boost' | 'giftcode';

interface PublicMessageLink {
  type: 'publicMessageLink';
  username: string;
  messageId: number;
  isSingle: boolean;
  threadId?: ThreadId;
  commentId?: number;
  mediaTimestamp?: string;
  isBoost: boolean;
}

export interface PrivateMessageLink {
  type: 'privateMessageLink';
  channelId: string;
  messageId: number;
  isSingle: boolean;
  threadId?: ThreadId;
  commentId?: number;
  mediaTimestamp?: string;
  isBoost: boolean;
}

interface ShareLink {
  type: 'shareLink';
  url: string;
  text?: string;
}

interface ChatFolderLink {
  type: 'chatFolderLink';
  slug: string;
}

interface LoginCodeLink {
  type: 'loginCodeLink';
  code: string;
}

interface TelegramPassportLink {
  type: 'telegramPassportLink';
  botId: number;
  scope: string;
  publicKey: string;
  nonce: string;
  callbackUrl?: string;
  payload?: string;
}

interface PublicUsernameOrBotLink {
  type: 'publicUsernameOrBotLink';
  username: string;
  parameter?: string;
}

type DeepLink =
  TelegramPassportLink |
  LoginCodeLink |
  PublicMessageLink |
  PrivateMessageLink |
  ShareLink |
  ChatFolderLink |
  PublicUsernameOrBotLink;

type BuilderParams<T extends DeepLink> = Record<keyof Omit<T, 'type'>, string | undefined>;
type BuilderReturnType<T extends DeepLink> = T | undefined;
type DeepLinkType = DeepLink['type'] | 'unknown';

type PrivateMessageLinkBuilderParams = Omit<BuilderParams<PrivateMessageLink>, 'isSingle' | 'isBoost'> & {
  single: string | undefined;
  boost: string | undefined;
};

type PublicMessageLinkBuilderParams = Omit<BuilderParams<PublicMessageLink>, 'isSingle' | 'isBoost'> & {
  single: string | undefined;
  boost: string | undefined;
};

const ELIGIBLE_HOSTNAMES = new Set(['t.me', 'telegram.me', 'telegram.dog']);

export function isDeepLink(link: string): boolean {
  return Boolean(link.match(RE_TME_LINK) || link.match(RE_TG_LINK));
}

export function tryParseDeepLink(link: string): DeepLink | undefined {
  if (!isDeepLink(link)) {
    return undefined;
  }
  try {
    return parseDeepLink(link);
  } catch (err) {
    return undefined;
  }
}

function parseDeepLink(url: string) {
  const correctUrl = ensureProtocol(url);
  if (!correctUrl) {
    return undefined;
  }
  if (correctUrl.startsWith('https:')) {
    const urlParsed = new URL(correctUrl);
    return parseHttpLink(urlParsed);
  }
  if (correctUrl.startsWith('tg:')) {
    // Chrome parse url with tg: protocol incorrectly
    const urlParsed = new URL(correctUrl.replace(/^tg:/, 'http:'));
    return parseTgLink(urlParsed);
  }
  return undefined;
}

function parseTgLink(url: URL) {
  const { hostname } = url;
  const queryParams = getQueryParams(url);
  const pathParams = getPathParams(url);
  const method = hostname as DeepLinkMethod;

  const deepLinkType = getTgDeepLinkType(queryParams, pathParams, method);
  switch (deepLinkType) {
    case 'publicMessageLink': {
      const {
        domain, post, single, thread, comment, t, boost,
      } = queryParams;
      return buildPublicMessageLink({
        username: domain,
        messageId: post,
        single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
        boost,
      });
    }
    case 'privateMessageLink': {
      const {
        channel, post, single, thread, comment, t, boost,
      } = queryParams;
      return buildPrivateMessageLink({
        channelId: channel,
        messageId: post,
        single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
        boost,
      });
    }
    case 'shareLink':
      return buildShareLink({ text: queryParams.text, url: queryParams.url });
    case 'chatFolderLink':
      return buildChatFolderLink({ slug: queryParams.slug });
    case 'loginCodeLink':
      return buildLoginCodeLink({ code: queryParams.code });
    case 'telegramPassportLink':
      return buildTelegramPassportLink({
        botId: queryParams.bot_id,
        scope: queryParams.scope,
        publicKey: queryParams.public_key,
        nonce: queryParams.nonce,
        callbackUrl: queryParams.callback_url,
        payload: queryParams.payload,
      });
    case 'publicUsernameOrBotLink':
      return buildPublicUsernameOrBotLink({
        username: queryParams.domain,
        parameter: queryParams.start,
      });
    default:
      break;
  }
  return undefined;
}

function parseHttpLink(url: URL) {
  if (!ELIGIBLE_HOSTNAMES.has(url.hostname)) {
    return undefined;
  }
  const queryParams = getQueryParams(url);
  const pathParams = getPathParams(url);

  const deepLinkType = getHttpDeepLinkType(queryParams, pathParams);
  switch (deepLinkType) {
    case 'publicMessageLink': {
      const {
        single, comment, t, boost,
      } = queryParams;
      const {
        username,
        thread,
        messageId,
      } = pathParams.length === 2 ? {
        username: pathParams[0],
        thread: queryParams.thread,
        messageId: pathParams[1],
      } : {
        username: pathParams[0],
        thread: pathParams[1],
        messageId: pathParams[2],
      };
      return buildPublicMessageLink({
        username,
        messageId,
        single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
        boost,
      });
    }
    case 'privateMessageLink': {
      const {
        single, comment, t, boost,
      } = queryParams;
      const {
        channelId,
        thread,
        messageId,
      } = pathParams.length === 3 ? {
        channelId: pathParams[1],
        thread: queryParams.thread,
        messageId: pathParams[2],
      } : {
        channelId: pathParams[1],
        thread: pathParams[2],
        messageId: pathParams[3],
      };
      return buildPrivateMessageLink({
        channelId,
        messageId,
        single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
        boost,
      });
    }
    case 'shareLink': {
      return buildShareLink({ text: queryParams.text, url: queryParams.url });
    }
    case 'chatFolderLink':
      return buildChatFolderLink({ slug: pathParams[1] });
    case 'loginCodeLink':
      return buildLoginCodeLink({ code: pathParams[1] });
    case 'publicUsernameOrBotLink':
      return buildPublicUsernameOrBotLink({
        username: pathParams[0],
        parameter: queryParams.start,
      });
    default:
      break;
  }
  return undefined;
}

function getHttpDeepLinkType(
  queryParams: Record<string, string>,
  pathParams: string[],
): DeepLinkType {
  const len = pathParams.length;
  const method = pathParams[0];
  if (len === 1) {
    if (method === 'share') {
      return 'shareLink';
    }
    if (isUsernameValid(method)) {
      return 'publicUsernameOrBotLink';
    }
  } else if (len === 2) {
    if (method === 'addlist') {
      return 'chatFolderLink';
    }
    if (method === 'login') {
      return 'loginCodeLink';
    }
    if (isUsernameValid(pathParams[0]) && isNumber(pathParams[1])) {
      return 'publicMessageLink';
    }
  } else if (len === 3) {
    if (method === 'c' && pathParams.slice(1).every(isNumber)) {
      return 'privateMessageLink';
    }
    if (isUsernameValid(pathParams[0]) && pathParams.slice(1).every(isNumber)) {
      return 'publicMessageLink';
    }
  } else if (len === 4) {
    if (method === 'c' && pathParams.slice(1).every(isNumber)) {
      return 'privateMessageLink';
    }
  }
  return 'unknown';
}

function getTgDeepLinkType(
  queryParams: Record<string, string>,
  pathParams: string[],
  method: DeepLinkMethod,
): DeepLinkType {
  switch (method) {
    case 'resolve': {
      const {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        domain, post, bot_id, scope, public_key, nonce,
      } = queryParams;
      if (domain === 'telegrampassport' && bot_id && scope && public_key && nonce) {
        return 'telegramPassportLink';
      }
      if (domain && post) {
        return 'publicMessageLink';
      }
      if (isUsernameValid(domain)) {
        return 'publicUsernameOrBotLink';
      }
      break;
    }
    case 'privatepost': {
      const { channel, post } = queryParams;
      if (channel && post) {
        return 'privateMessageLink';
      }
      break;
    }
    case 'msg_url':
      return 'shareLink';
    case 'addlist':
      return 'chatFolderLink';
    case 'login':
      return 'loginCodeLink';
    case 'passport':
      return 'telegramPassportLink';
    default:
      break;
  }
  return 'unknown';
}

function buildShareLink(params: BuilderParams<ShareLink>): BuilderReturnType<ShareLink> {
  const { url, text } = params;
  if (!url) {
    return undefined;
  }
  return {
    type: 'shareLink',
    url,
    text,
  };
}

function buildPublicMessageLink(params: PublicMessageLinkBuilderParams): BuilderReturnType<PublicMessageLink> {
  const {
    messageId, threadId, commentId, username, single, mediaTimestamp, boost,
  } = params;
  if (!username || !isUsernameValid(username)) {
    return undefined;
  }
  if (!messageId || !isNumber(messageId)) {
    return undefined;
  }
  if (threadId && !isNumber(threadId)) {
    return undefined;
  }
  if (commentId && !isNumber(commentId)) {
    return undefined;
  }
  return {
    type: 'publicMessageLink',
    username,
    messageId: Number(messageId),
    isSingle: single === '',
    threadId: threadId ? Number(threadId) : undefined,
    commentId: commentId ? Number(commentId) : undefined,
    mediaTimestamp,
    isBoost: boost === '',
  };
}

function buildPrivateMessageLink(params: PrivateMessageLinkBuilderParams): BuilderReturnType<PrivateMessageLink> {
  const {
    messageId, threadId, commentId, channelId, single, mediaTimestamp, boost,
  } = params;
  if (!channelId || !isNumber(channelId)) {
    return undefined;
  }
  if (!messageId || !isNumber(messageId)) {
    return undefined;
  }
  if (threadId && !isNumber(threadId)) {
    return undefined;
  }
  if (commentId && !isNumber(commentId)) {
    return undefined;
  }
  return {
    type: 'privateMessageLink',
    channelId,
    messageId: Number(messageId),
    isSingle: single === '',
    threadId: threadId ? Number(threadId) : undefined,
    commentId: commentId ? Number(commentId) : undefined,
    mediaTimestamp,
    isBoost: boost === '',
  };
}

function buildChatFolderLink(params: BuilderParams<ChatFolderLink>): BuilderReturnType<ChatFolderLink> {
  const {
    slug,
  } = params;
  if (!slug) {
    return undefined;
  }
  return {
    type: 'chatFolderLink',
    slug,
  };
}

function buildLoginCodeLink(params: BuilderParams<LoginCodeLink>): BuilderReturnType<LoginCodeLink> {
  const {
    code,
  } = params;
  if (!code) {
    return undefined;
  }
  return {
    type: 'loginCodeLink',
    code,
  };
}

function buildTelegramPassportLink(
  params: BuilderParams<TelegramPassportLink>,
): BuilderReturnType<TelegramPassportLink> {
  const {
    botId,
    scope,
    publicKey,
    nonce,
    callbackUrl,
    payload,
  } = params;
  if (!botId || !isNumber(botId) || !scope || !publicKey || !nonce) {
    return undefined;
  }
  return {
    type: 'telegramPassportLink',
    botId: Number(botId),
    scope,
    publicKey,
    nonce,
    callbackUrl,
    payload,
  };
}

function buildPublicUsernameOrBotLink(
  params: BuilderParams<PublicUsernameOrBotLink>,
): BuilderReturnType<PublicUsernameOrBotLink> {
  const {
    username,
    parameter,
  } = params;
  if (!username) {
    return undefined;
  }
  if (!isUsernameValid(username)) {
    return undefined;
  }
  return {
    type: 'publicUsernameOrBotLink',
    username,
    parameter,
  };
}

function isNumber(s: string) {
  return /^-?\d+$/.test(s);
}

function getPathParams(url: URL) {
  return url.pathname.split('/').filter(Boolean).map(decodeURI);
}

function getQueryParams(url: URL) {
  return Object.fromEntries(url.searchParams);
}
