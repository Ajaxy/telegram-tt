import { RE_TG_LINK, RE_TME_LINK } from '../config';
import { isUsernameValid } from './username';

export type DeepLinkMethod = 'resolve' | 'login' | 'passport' | 'settings' | 'join' | 'addstickers' | 'addemoji' |
'setlanguage' | 'addtheme' | 'confirmphone' | 'socks' | 'proxy' | 'privatepost' | 'bg' | 'share' | 'msg' | 'msg_url' |
'invoice' | 'addlist' | 'boost' | 'giftcode';

export enum DeepLinkType {
  PublicMessageLink = 'PublicMessageLink',
  PrivateMessageLink = 'PrivateMessageLink',
  ShareLink = 'ShareLink',
  ChatFolderLink = 'ChatFolderLink',
  Unknown = 'Unknown',
}

interface PublicMessageLink {
  type: DeepLinkType.PublicMessageLink;
  username: string;
  messageId: number;
  isSingle?: boolean;
  threadId?: number;
  commentId?: number;
  mediaTimestamp?: string;
}

interface PrivateMessageLink {
  type: DeepLinkType.PrivateMessageLink;
  channelId: string;
  messageId: number;
  isSingle?: boolean;
  threadId?: number;
  commentId?: number;
  mediaTimestamp?: string;
}

interface ShareLink {
  type: DeepLinkType.ShareLink;
  url: string;
  text?: string;
}

interface ChatFolderLink {
  type: DeepLinkType.ChatFolderLink;
  slug: string;
}

type DeepLink = PublicMessageLink | PrivateMessageLink | ShareLink | ChatFolderLink;

type BuilderParams<T extends DeepLink> = Record<keyof Omit<T, 'type'>, string>;
type BuilderReturnType<T extends DeepLink> = T | undefined;

const ELIGIBLE_HOSTNAMES = new Set(['t.me', 'telegram.me', 'telegram.dog']);

export function isDeepLink(link: string): boolean {
  return Boolean(link.match(RE_TME_LINK) || link.match(RE_TG_LINK));
}

export function tryParseDeepLink(link: string): DeepLink | undefined {
  try {
    return parseDeepLink(link);
  } catch (err) {
    return undefined;
  }
}

function parseDeepLink(url: string) {
  if (url.startsWith('https:')) {
    const urlParsed = new URL(url);
    return handleHttpLink(urlParsed);
  }
  if (url.startsWith('tg:')) {
    // Chrome parse url with tg: protocol incorrectly
    const urlParsed = new URL(url.replace(/^tg:/, 'http:'));
    return handleTgLink(urlParsed);
  }
  return undefined;
}

function handleTgLink(url: URL) {
  const { hostname } = url;
  const queryParams = getQueryParams(url);
  const pathParams = getPathParams(url);
  const method = hostname as DeepLinkMethod;

  const deepLinkType = getTgDeepLinkType(queryParams, pathParams, method);
  switch (deepLinkType) {
    case DeepLinkType.PublicMessageLink: {
      const {
        domain, post, single, thread, comment, t,
      } = queryParams;
      return buildPublicMessageLink({
        username: domain,
        messageId: post,
        isSingle: single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
      });
    }
    case DeepLinkType.PrivateMessageLink: {
      const {
        channel, post, single, thread, comment, t,
      } = queryParams;
      return buildPrivateMessageLink({
        channelId: channel,
        messageId: post,
        isSingle: single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
      });
    }
    case DeepLinkType.ShareLink:
      return buildShareLink({ text: queryParams.text, url: queryParams.url });
    case DeepLinkType.ChatFolderLink:
      return buildChatFolderLink({ slug: queryParams.slug });
    default:
      break;
  }
  return undefined;
}

function handleHttpLink(url: URL) {
  if (!ELIGIBLE_HOSTNAMES.has(url.hostname)) {
    return undefined;
  }
  const queryParams = getQueryParams(url);
  const pathParams = getPathParams(url);

  const deepLinkType = getHttpDeepLinkType(queryParams, pathParams);
  switch (deepLinkType) {
    case DeepLinkType.PublicMessageLink: {
      const {
        single, comment, t,
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
        isSingle: single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
      });
    }
    case DeepLinkType.PrivateMessageLink: {
      const {
        single, comment, t,
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
        isSingle: single,
        threadId: thread,
        commentId: comment,
        mediaTimestamp: t,
      });
    }
    case DeepLinkType.ShareLink: {
      return buildShareLink({ text: queryParams.text, url: queryParams.url });
    }
    case DeepLinkType.ChatFolderLink:
      return buildChatFolderLink({ slug: pathParams[1] });
    default:
      break;
  }
  return undefined;
}

function getHttpDeepLinkType(
  queryParams: Record<string, string>,
  pathParams: string[],
) {
  const len = pathParams.length;
  const method = pathParams[0];
  if (len === 1) {
    if (method === 'share') {
      return DeepLinkType.ShareLink;
    }
  } else if (len === 2) {
    if (method === 'addlist') {
      return DeepLinkType.ChatFolderLink;
    }
    if (isUsernameValid(pathParams[0]) && isNumber(pathParams[1])) {
      return DeepLinkType.PublicMessageLink;
    }
  } else if (len === 3) {
    if (method === 'c' && pathParams.slice(1).every(isNumber)) {
      return DeepLinkType.PrivateMessageLink;
    }
    if (isUsernameValid(pathParams[0]) && pathParams.slice(1).every(isNumber)) {
      return DeepLinkType.PublicMessageLink;
    }
  } else if (len === 4) {
    if (method === 'c' && pathParams.slice(1).every(isNumber)) {
      return DeepLinkType.PrivateMessageLink;
    }
  }
  return DeepLinkType.Unknown;
}

function getTgDeepLinkType(
  queryParams: Record<string, string>,
  pathParams: string[],
  method: DeepLinkMethod,
) {
  switch (method) {
    case 'resolve': {
      const { domain, post } = queryParams;
      if (domain && post) {
        return DeepLinkType.PublicMessageLink;
      }
      break;
    }
    case 'privatepost': {
      const { channel, post } = queryParams;
      if (channel && post) {
        return DeepLinkType.PrivateMessageLink;
      }
      break;
    }
    case 'msg_url':
      return DeepLinkType.ShareLink;
    case 'addlist':
      return DeepLinkType.ChatFolderLink;
    default:
      break;
  }
  return DeepLinkType.Unknown;
}

function buildShareLink(params: BuilderParams<ShareLink>): BuilderReturnType<ShareLink> {
  const { url, text } = params;
  if (!url) {
    return undefined;
  }
  return {
    type: DeepLinkType.ShareLink,
    url,
    text,
  };
}

function buildPublicMessageLink(params: BuilderParams<PublicMessageLink>): BuilderReturnType<PublicMessageLink> {
  const {
    messageId, threadId, commentId, username, isSingle, mediaTimestamp,
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
    type: DeepLinkType.PublicMessageLink,
    username,
    messageId: Number(messageId),
    isSingle: isSingle === '',
    threadId: threadId ? Number(threadId) : undefined,
    commentId: commentId ? Number(commentId) : undefined,
    mediaTimestamp,
  };
}

function buildPrivateMessageLink(params: BuilderParams<PrivateMessageLink>): BuilderReturnType<PrivateMessageLink> {
  const {
    messageId, threadId, commentId, channelId, isSingle, mediaTimestamp,
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
    type: DeepLinkType.PrivateMessageLink,
    channelId,
    messageId: Number(messageId),
    isSingle: isSingle === '',
    threadId: threadId ? Number(threadId) : undefined,
    commentId: commentId ? Number(commentId) : undefined,
    mediaTimestamp,
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
    type: DeepLinkType.ChatFolderLink,
    slug,
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
