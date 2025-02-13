import type { ThreadId } from '../types';

import { RE_TG_LINK, RE_TME_LINK } from '../config';
import { toChannelId } from '../global/helpers';
import { ensureProtocol } from './ensureProtocol';
import { isUsernameValid } from './username';
import { IS_BAD_URL_PARSER } from './windowEnvironment';

export type DeepLinkMethod = 'resolve' | 'login' | 'passport' | 'settings' | 'join' | 'addstickers' | 'addemoji' |
'setlanguage' | 'addtheme' | 'confirmphone' | 'socks' | 'proxy' | 'privatepost' | 'bg' | 'share' | 'msg' | 'msg_url' |
'invoice' | 'addlist' | 'boost' | 'giftcode' | 'message' | 'premium_offer' | 'premium_multigift' | 'stars_topup'
| 'nft';

interface PublicMessageLink {
  type: 'publicMessageLink';
  username: string;
  messageId: number;
  isSingle: boolean;
  threadId?: ThreadId;
  commentId?: number;
}

export interface PrivateMessageLink {
  type: 'privateMessageLink';
  channelId: string;
  messageId: number;
  isSingle: boolean;
  threadId?: ThreadId;
  commentId?: number;
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
  start?: string;
  ref?: string;
  startApp?: string;
  mode?: string;
  appName?: string;
  startAttach?: string;
  attach?: string;
  text?: string;
  choose?: string;
}

interface PrivateChannelLink {
  type: 'privateChannelLink';
  channelId: string;
}

interface ChatBoostLink {
  type: 'chatBoostLink';
  username?: string;
  id?: string;
}

interface BusinessChatLink {
  type: 'businessChatLink';
  slug: string;
}

interface PremiumReferrerLink {
  type: 'premiumReferrerLink';
  referrer: string;
}

interface PremiumMultigiftLink {
  type: 'premiumMultigiftLink';
  referrer: string;
}

interface GiftUniqueLink {
  type: 'giftUniqueLink';
  slug: string;
}

type DeepLink =
  TelegramPassportLink |
  LoginCodeLink |
  PublicMessageLink |
  PrivateMessageLink |
  ShareLink |
  ChatFolderLink |
  PublicUsernameOrBotLink |
  PrivateChannelLink |
  BusinessChatLink |
  PremiumReferrerLink |
  PremiumMultigiftLink |
  ChatBoostLink |
  GiftUniqueLink;

type BuilderParams<T extends DeepLink> = Record<keyof Omit<T, 'type'>, string | undefined>;
type BuilderReturnType<T extends DeepLink> = T | undefined;
type DeepLinkType = DeepLink['type'] | 'unknown';

type PrivateMessageLinkBuilderParams = Omit<BuilderParams<PrivateMessageLink>, 'isSingle'> & {
  single?: string;
};

type PublicMessageLinkBuilderParams = Omit<BuilderParams<PublicMessageLink>, 'isSingle'> & {
  single?: string;
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
  if (correctUrl.startsWith('https:') || correctUrl.startsWith('http:')) {
    const urlParsed = new URL(correctUrl);
    return parseHttpLink(urlParsed);
  }
  if (correctUrl.startsWith('tg:')) {
    const urlToParse = IS_BAD_URL_PARSER ? correctUrl.replace(/^tg:\/\//, 'https://') : correctUrl;
    const urlParsed = new URL(urlToParse);
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
        domain, post, single, thread, comment,
      } = queryParams;
      return buildPublicMessageLink({
        username: domain,
        messageId: post,
        single,
        threadId: thread,
        commentId: comment,
      });
    }
    case 'privateMessageLink': {
      const {
        channel, post, single, thread, comment,
      } = queryParams;
      return buildPrivateMessageLink({
        channelId: channel,
        messageId: post,
        single,
        threadId: thread,
        commentId: comment,
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
        start: queryParams.start,
        text: queryParams.text,
        appName: queryParams.appname,
        startApp: queryParams.startapp,
        mode: queryParams.mode,
        startAttach: queryParams.startattach,
        attach: queryParams.attach,
        choose: queryParams.choose,
        ref: queryParams.ref,
      });
    case 'privateChannelLink': {
      return buildPrivateChannelLink({ channelId: queryParams.channel });
    }
    case 'businessChatLink':
      return buildBusinessChatLink({ slug: queryParams.slug });
    case 'premiumReferrerLink':
      return buildPremiumReferrerLink({ referrer: queryParams.ref });
    case 'premiumMultigiftLink':
      return buildPremiumMultigiftLink({ referrer: queryParams.ref });
    case 'chatBoostLink':
      return buildChatBoostLink({ username: queryParams.domain, id: queryParams.channel });
    case 'giftUniqueLink':
      return buildGiftUniqueLink({ slug: queryParams.slug });
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
        single, comment,
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
      });
    }
    case 'privateMessageLink': {
      const {
        single, comment,
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
        start: queryParams.start,
        text: queryParams.text,
        startApp: queryParams.startapp,
        mode: queryParams.mode,
        appName: undefined,
        startAttach: queryParams.startattach,
        attach: queryParams.attach,
        choose: queryParams.choose,
        ref: queryParams.ref,
      });
    case 'privateChannelLink': {
      return buildPrivateChannelLink({ channelId: pathParams[1] });
    }
    case 'businessChatLink':
      return buildBusinessChatLink({ slug: pathParams[1] });
    case 'chatBoostLink': {
      if (pathParams[0] === 'boost') {
        return buildChatBoostLink({ username: pathParams[1], id: queryParams.c });
      }
      const isPrivateChannel = pathParams[0] === 'c';
      return buildChatBoostLink({
        username: !isPrivateChannel ? pathParams[0] : undefined,
        id: isPrivateChannel ? pathParams[1] : undefined,
      });
    }
    case 'giftUniqueLink': {
      const slug = pathParams.slice(1).join('/');
      return buildGiftUniqueLink({
        slug,
      });
    }
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
    if (method === 'share') return 'shareLink';
    if (method === 'boost' || queryParams.boost !== undefined) return 'chatBoostLink';

    if (isUsernameValid(method)) {
      return 'publicUsernameOrBotLink';
    }
  } else if (len === 2) {
    if (method === 'addlist') return 'chatFolderLink';
    if (method === 'login') return 'loginCodeLink';
    if (method === 'm') return 'businessChatLink';
    if (method === 'boost') return 'chatBoostLink';
    if (method === 'nft') return 'giftUniqueLink';
    if (method === 'c') {
      if (queryParams.boost !== undefined) return 'chatBoostLink';
      return 'privateChannelLink';
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
    if (method === 'nft') return 'giftUniqueLink';
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
      if (channel) {
        if (post) return 'privateMessageLink';
        return 'privateChannelLink';
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
    case 'message':
      return 'businessChatLink';
    case 'premium_offer':
      return 'premiumReferrerLink';
    case 'premium_multigift':
      return 'premiumMultigiftLink';
    case 'boost':
      return 'chatBoostLink';
    case 'nft':
      return 'giftUniqueLink';
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
    messageId, threadId, commentId, username, single,
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
  };
}

function buildPrivateMessageLink(params: PrivateMessageLinkBuilderParams): BuilderReturnType<PrivateMessageLink> {
  const {
    messageId, threadId, commentId, channelId, single,
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
    channelId: toChannelId(channelId),
    messageId: Number(messageId),
    isSingle: single === '',
    threadId: threadId ? Number(threadId) : undefined,
    commentId: commentId ? Number(commentId) : undefined,
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
    start,
    text,
    startApp,
    mode,
    startAttach,
    attach,
    appName,
    choose,
    ref,
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
    start,
    startApp,
    mode,
    appName,
    startAttach,
    attach,
    text,
    choose,
    ref,
  };
}

function buildPrivateChannelLink(params: BuilderParams<PrivateChannelLink>): BuilderReturnType<PrivateChannelLink> {
  const {
    channelId,
  } = params;
  if (!channelId) {
    return undefined;
  }

  return {
    type: 'privateChannelLink',
    channelId: toChannelId(channelId),
  };
}

export function buildChatBoostLink(params: BuilderParams<ChatBoostLink>): BuilderReturnType<ChatBoostLink> {
  const {
    username,
    id,
  } = params;

  if (!username && !id) {
    return undefined;
  }

  return {
    type: 'chatBoostLink',
    username,
    id: id ? toChannelId(id) : undefined,
  };
}

function buildBusinessChatLink(params: BuilderParams<BusinessChatLink>): BuilderReturnType<BusinessChatLink> {
  const {
    slug,
  } = params;

  if (!slug) {
    return undefined;
  }

  return {
    type: 'businessChatLink',
    slug,
  };
}

function buildGiftUniqueLink(params: BuilderParams<GiftUniqueLink>): BuilderReturnType<GiftUniqueLink> {
  const {
    slug,
  } = params;

  if (!slug) {
    return undefined;
  }

  return {
    type: 'giftUniqueLink',
    slug,
  };
}

function buildPremiumReferrerLink(params: BuilderParams<PremiumReferrerLink>): BuilderReturnType<PremiumReferrerLink> {
  const {
    referrer,
  } = params;

  if (!referrer) {
    return undefined;
  }

  return {
    type: 'premiumReferrerLink',
    referrer,
  };
}

function buildPremiumMultigiftLink(
  params: BuilderParams<PremiumMultigiftLink>,
): BuilderReturnType<PremiumMultigiftLink> {
  const {
    referrer,
  } = params;

  if (!referrer) {
    return undefined;
  }

  return {
    type: 'premiumMultigiftLink',
    referrer,
  };
}

function isNumber(s: string) {
  return /^-?\d+$/.test(s);
}

function getPathParams(url: URL) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 's') {
    parts.shift();
  }
  return parts.map(decodeURI);
}

function getQueryParams(url: URL) {
  return Object.fromEntries(url.searchParams);
}
