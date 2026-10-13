import type { ApiMessage } from '../../api/types';
import type {
  CatchUpLink, CatchUpMedia, CatchUpMessageRef, CatchUpSender, CatchUpSummary,
} from '../../types/catchUp';
import { ApiMessageEntityTypes } from '../../api/types';

import { isActionMessage } from './messages';

export type CatchUpAccumulator = {
  chatId: string;
  currentUserId?: string;
  ownMessageIds: Set<number>;
  totalMessages: number;
  firstUnreadId: number;
  firstDate: number;
  lastDate: number;
  senders: Map<string, number>;
  media: CatchUpMedia;
  mentions: CatchUpMessageRef[];
  replies: CatchUpMessageRef[];
  questions: CatchUpMessageRef[];
  links: CatchUpLink[];
  pinned: CatchUpMessageRef[];
};

const SNIPPET_LENGTH = 100;
const MAX_LIST_ITEMS = 5;
const QUESTION_REGEX = /\?\s*$|\?\s/m;

export function createCatchUpAccumulator(
  chatId: string, currentUserId: string | undefined, ownMessageIds: number[],
): CatchUpAccumulator {
  return {
    chatId,
    currentUserId,
    ownMessageIds: new Set(ownMessageIds),
    totalMessages: 0,
    firstUnreadId: 0,
    firstDate: 0,
    lastDate: 0,
    senders: new Map(),
    media: {
      photos: 0, videos: 0, voices: 0, files: 0, stickers: 0, polls: 0, firstMessageIdByKind: {},
    },
    mentions: [],
    replies: [],
    questions: [],
    links: [],
    pinned: [],
  };
}

// Messages are expected newest first
export function accumulateCatchUp(acc: CatchUpAccumulator, messages: ApiMessage[]) {
  for (const message of messages) {
    if (isActionMessage(message) || message.isScheduled || message.isEphemeral) continue;
    if (message.isOutgoing) {
      acc.ownMessageIds.add(message.id);
      continue;
    }

    acc.totalMessages++;
    acc.firstUnreadId = message.id;
    acc.firstDate = message.date;
    acc.lastDate = acc.lastDate || message.date;

    const senderId = message.senderId || message.chatId;
    acc.senders.set(senderId, (acc.senders.get(senderId) || 0) + 1);

    accumulateMedia(acc, message);

    const ref = buildRef(message);
    if (message.isMentioned) acc.mentions.push(ref);
    const replyToId = message.replyInfo?.type === 'message' ? message.replyInfo.replyToMsgId : undefined;
    if (replyToId && acc.ownMessageIds.has(replyToId)) acc.replies.push(ref);
    if (message.isPinned) acc.pinned.push(ref);

    const text = message.content.text?.text;
    if (text && QUESTION_REGEX.test(text)) acc.questions.push(ref);
    if (text) accumulateLinks(acc, message, text);
  }
}

export function finalizeCatchUp(acc: CatchUpAccumulator, isComplete: boolean): CatchUpSummary {
  const senders: CatchUpSender[] = Array.from(acc.senders.entries())
    .map(([peerId, messageCount]) => ({ peerId, messageCount }))
    .sort((a, b) => b.messageCount - a.messageCount);

  return {
    chatId: acc.chatId,
    totalMessages: acc.totalMessages,
    isComplete,
    firstUnreadId: acc.firstUnreadId,
    firstDate: acc.firstDate,
    lastDate: acc.lastDate,
    senders,
    media: acc.media,
    // Lists were filled newest first, show oldest first
    mentions: acc.mentions.reverse().slice(0, MAX_LIST_ITEMS),
    replies: acc.replies.reverse().slice(0, MAX_LIST_ITEMS),
    questions: acc.questions.reverse().slice(0, MAX_LIST_ITEMS),
    links: dedupeLinks(acc.links.reverse()).slice(0, MAX_LIST_ITEMS),
    pinned: acc.pinned.reverse().slice(0, MAX_LIST_ITEMS),
  };
}

function accumulateMedia(acc: CatchUpAccumulator, message: ApiMessage) {
  const {
    photo, video, voice, document, sticker, pollId,
  } = message.content;
  const { media } = acc;

  const kind = photo ? 'photos'
    : video && !video.isRound ? 'videos'
      : voice || video?.isRound ? 'voices'
        : sticker ? 'stickers'
          : document ? 'files'
            : pollId ? 'polls'
              : undefined;
  if (!kind) return;

  media[kind]++;
  // Newest first, so the last written id is the oldest one
  media.firstMessageIdByKind[kind] = message.id;
}

function accumulateLinks(acc: CatchUpAccumulator, message: ApiMessage, text: string) {
  const entities = message.content.text?.entities || [];
  for (const entity of entities) {
    const url = entity.type === ApiMessageEntityTypes.TextUrl
      ? entity.url
      : entity.type === ApiMessageEntityTypes.Url
        ? text.slice(entity.offset, entity.offset + entity.length)
        : undefined;
    if (!url) continue;

    const domain = getDomain(url);
    if (!domain) continue;

    acc.links.push({ messageId: message.id, url, domain });
  }
}

function buildRef(message: ApiMessage): CatchUpMessageRef {
  return {
    messageId: message.id,
    senderId: message.senderId,
    text: message.content.text?.text.slice(0, SNIPPET_LENGTH),
    date: message.date,
  };
}

function dedupeLinks(links: CatchUpLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function getDomain(url: string) {
  try {
    const withProtocol = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
