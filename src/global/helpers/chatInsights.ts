import type { ApiMessage } from '../../api/types';
import type {
  ChatInsights, ChatInsightsEmoji, ChatInsightsMedia, ChatInsightsSender, ChatInsightsTopMessage,
} from '../../types/chatInsights';
import { ApiMessageEntityTypes } from '../../api/types';

import { isActionMessage } from './messages';

type SenderAccumulator = {
  messageCount: number;
  replyTimes: number[];
};

export type ChatInsightsAccumulator = {
  chatId: string;
  currentUserId?: string;
  totalMessages: number;
  firstMessageDate: number;
  lastMessageDate: number;
  dayKeys: Set<number>;
  senders: Map<string, SenderAccumulator>;
  byHour: number[];
  byWeekday: number[];
  media: ChatInsightsMedia;
  emoji: Map<string, number>;
  topMessage?: ChatInsightsTopMessage;
  nightMessages: number;
  totalCharacters: number;
  // Oldest processed message, used to attribute reply times across batches
  previousMessage?: ApiMessage;
};

const HOURS_IN_DAY = 24;
const DAYS_IN_WEEK = 7;
const SECONDS_IN_DAY = 24 * 60 * 60;
const NIGHT_END_HOUR = 5;
const MAX_REPLY_GAP = 60 * 60;
const TOP_EMOJI_COUNT = 5;
const TOP_MESSAGE_TEXT_LENGTH = 120;
const EMOJI_PART = '\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?';
const EMOJI_REGEX = new RegExp(`${EMOJI_PART}(?:\\u200D${EMOJI_PART})*`, 'gu');

export function createChatInsightsAccumulator(chatId: string, currentUserId?: string): ChatInsightsAccumulator {
  return {
    chatId,
    currentUserId,
    totalMessages: 0,
    firstMessageDate: 0,
    lastMessageDate: 0,
    dayKeys: new Set(),
    senders: new Map(),
    byHour: new Array(HOURS_IN_DAY).fill(0),
    byWeekday: new Array(DAYS_IN_WEEK).fill(0),
    media: {
      photos: 0,
      videos: 0,
      voices: 0,
      videoMessages: 0,
      stickers: 0,
      gifs: 0,
      files: 0,
      links: 0,
      polls: 0,
    },
    emoji: new Map(),
    nightMessages: 0,
    totalCharacters: 0,
  };
}

// Messages are expected newest first, as returned by history requests
export function accumulateChatInsights(acc: ChatInsightsAccumulator, messages: ApiMessage[]) {
  for (const message of messages) {
    if (isActionMessage(message) || message.isScheduled || message.isEphemeral) continue;

    acc.totalMessages++;
    acc.lastMessageDate = Math.max(acc.lastMessageDate, message.date);
    acc.firstMessageDate = acc.firstMessageDate ? Math.min(acc.firstMessageDate, message.date) : message.date;

    const date = new Date(message.date * 1000);
    acc.byHour[date.getHours()]++;
    acc.byWeekday[date.getDay()]++;
    acc.dayKeys.add(Math.floor((message.date - date.getTimezoneOffset() * 60) / SECONDS_IN_DAY));
    if (date.getHours() < NIGHT_END_HOUR) acc.nightMessages++;

    accumulateSender(acc, message);
    accumulateContent(acc, message);
    accumulateReactions(acc, message);

    acc.previousMessage = message;
  }
}

export function finalizeChatInsights(acc: ChatInsightsAccumulator, isComplete: boolean): ChatInsights {
  const senders: ChatInsightsSender[] = Array.from(acc.senders.entries())
    .map(([peerId, { messageCount, replyTimes }]) => ({
      peerId,
      messageCount,
      replyTimeMedian: getMedian(replyTimes),
    }))
    .sort((a, b) => b.messageCount - a.messageCount);

  const topEmoji: ChatInsightsEmoji[] = Array.from(acc.emoji.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_EMOJI_COUNT);

  return {
    chatId: acc.chatId,
    totalMessages: acc.totalMessages,
    isComplete,
    firstMessageDate: acc.firstMessageDate,
    lastMessageDate: acc.lastMessageDate,
    activeDays: acc.dayKeys.size,
    longestStreakDays: getLongestStreak(acc.dayKeys),
    senders,
    byHour: acc.byHour,
    byWeekday: acc.byWeekday,
    media: acc.media,
    topEmoji,
    topMessage: acc.topMessage,
    nightMessages: acc.nightMessages,
    totalCharacters: acc.totalCharacters,
  };
}

function accumulateSender(acc: ChatInsightsAccumulator, message: ApiMessage) {
  const senderId = getSenderId(acc, message);
  const sender = acc.senders.get(senderId) || { messageCount: 0, replyTimes: [] };
  sender.messageCount++;

  // `previousMessage` is newer, so the gap is how fast its sender replied to this one
  const newer = acc.previousMessage;
  if (newer) {
    const newerSenderId = getSenderId(acc, newer);
    const gap = newer.date - message.date;
    if (newerSenderId !== senderId && gap > 0 && gap <= MAX_REPLY_GAP) {
      acc.senders.get(newerSenderId)?.replyTimes.push(gap);
    }
  }

  acc.senders.set(senderId, sender);
}

// Private chats carry no `senderId`, so the side is derived from the direction
function getSenderId(acc: ChatInsightsAccumulator, message: ApiMessage) {
  if (message.senderId) return message.senderId;
  return message.isOutgoing && acc.currentUserId ? acc.currentUserId : message.chatId;
}

function accumulateContent(acc: ChatInsightsAccumulator, message: ApiMessage) {
  const {
    text, photo, video, voice, sticker, document, pollId, webPage,
  } = message.content;
  const { media } = acc;

  if (photo) media.photos++;
  if (video) {
    if (video.isRound) media.videoMessages++;
    else if (video.isGif) media.gifs++;
    else media.videos++;
  }
  if (voice) media.voices++;
  if (sticker) media.stickers++;
  if (document) media.files++;
  if (pollId) media.polls++;
  if (webPage || text?.entities?.some((entity) => (
    entity.type === ApiMessageEntityTypes.Url || entity.type === ApiMessageEntityTypes.TextUrl
  ))) {
    media.links++;
  }

  if (!text?.text) return;

  acc.totalCharacters += text.text.length;
  for (const match of text.text.matchAll(EMOJI_REGEX)) {
    const emoji = match[0];
    acc.emoji.set(emoji, (acc.emoji.get(emoji) || 0) + 1);
  }
}

function accumulateReactions(acc: ChatInsightsAccumulator, message: ApiMessage) {
  const reactionCount = message.reactions?.results.reduce((sum, result) => sum + result.count, 0) || 0;
  if (!reactionCount || (acc.topMessage && acc.topMessage.reactionCount >= reactionCount)) return;

  acc.topMessage = {
    messageId: message.id,
    senderId: getSenderId(acc, message),
    text: message.content.text?.text.slice(0, TOP_MESSAGE_TEXT_LENGTH),
    reactionCount,
  };
}

function getMedian(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function getLongestStreak(dayKeys: Set<number>) {
  const days = Array.from(dayKeys).sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous: number | undefined;

  for (const day of days) {
    current = previous !== undefined && day === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }

  return longest;
}
