import { Api as GramJs } from '../../../lib/gramjs';
import { generateRandomBigInt } from '../../../lib/gramjs/Helpers';

import type { ApiMessage, ApiTopic } from '../../types';
import type {
  ApiChat,
  ApiDraft,
  ApiPeer,
} from '../../types/chats';

import { GENERAL_TOPIC_ID, TOPICS_SLICE } from '../../../config';
import { buildApiTopic } from '../apiBuilders/forums';
import { buildApiMessage, buildMessageDraft } from '../apiBuilders/messages';
import { buildInputPeer, DEFAULT_PRIMITIVES } from '../gramjsBuilders';
import { processAffectedHistory } from '../updates/updateManager';
import { invokeRequest } from './client';

export async function createTopic({
  chat, title, iconColor, iconEmojiId, sendAs, isTitleMissing,
}: {
  chat: ApiChat;
  title: string;
  iconColor?: number;
  iconEmojiId?: string;
  sendAs?: ApiPeer;
  isTitleMissing?: true;
}) {
  const { id, accessHash } = chat;

  const updates = await invokeRequest(new GramJs.messages.CreateForumTopic({
    peer: buildInputPeer(id, accessHash),
    title,
    iconColor,
    iconEmojiId: iconEmojiId ? BigInt(iconEmojiId) : undefined,
    sendAs: sendAs ? buildInputPeer(sendAs.id, sendAs.accessHash) : undefined,
    randomId: generateRandomBigInt(),
    titleMissing: isTitleMissing,
  }));

  if (!(updates instanceof GramJs.Updates) || !updates.updates.length) {
    return undefined;
  }

  // Finding topic id in updates
  return updates.updates?.find((update): update is GramJs.UpdateMessageID => (
    update instanceof GramJs.UpdateMessageID
  ))?.id;
}

export async function fetchTopics({
  chat, query, offsetTopicId, offsetId, offsetDate, limit = TOPICS_SLICE,
}: {
  chat: ApiChat;
  query?: string;
  offsetTopicId?: number;
  offsetId?: number;
  offsetDate?: number;
  limit?: number;
}): Promise<{
  topics: ApiTopic[];
  messages: ApiMessage[];
  count: number;
  shouldOrderByCreateDate?: boolean;
  draftsById: Record<number, ApiDraft | undefined>;
  readInboxMessageIdByTopicId: Record<number, number>;
} | undefined> {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetForumTopics({
    peer: buildInputPeer(id, accessHash),
    limit,
    q: query,
    offsetTopic: offsetTopicId ?? DEFAULT_PRIMITIVES.INT,
    offsetId: offsetId ?? DEFAULT_PRIMITIVES.INT,
    offsetDate: offsetDate ?? DEFAULT_PRIMITIVES.INT,
  }));

  if (!result) return undefined;

  const { orderByCreateDate } = result;

  const topics = result.topics.map(buildApiTopic).filter(Boolean);
  const count = result.count === 0 ? topics.length : result.count; // Sometimes count is 0 in result, but we have topics
  const messages = result.messages.map(buildApiMessage).filter(Boolean);
  const draftsById = result.topics.reduce((acc, topic) => {
    if (topic instanceof GramJs.ForumTopic && topic.draft) {
      acc[topic.id] = buildMessageDraft(topic.draft);
    }
    return acc;
  }, {} as Record<number, ReturnType<typeof buildMessageDraft>>);
  const readInboxMessageIdByTopicId = result.topics.reduce((acc, topic) => {
    if (topic instanceof GramJs.ForumTopic && topic.readInboxMaxId) {
      acc[topic.id] = topic.readInboxMaxId;
    }
    return acc;
  }, {} as Record<number, number>);

  return {
    topics,
    messages,
    // Include general topic
    count: count + 1,
    shouldOrderByCreateDate: orderByCreateDate,
    draftsById,
    readInboxMessageIdByTopicId,
  };
}

export async function fetchTopicById({
  chat, topicId,
}: {
  chat: ApiChat;
  topicId: number;
}): Promise<{
  topic: ApiTopic;
  messages: ApiMessage[];
} | undefined> {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.GetForumTopicsByID({
    peer: buildInputPeer(id, accessHash),
    topics: [topicId],
  }));

  if (!result?.topics.length || !(result.topics[0] instanceof GramJs.ForumTopic)) {
    return undefined;
  }

  const messages = result.messages.map(buildApiMessage).filter(Boolean);

  return {
    topic: buildApiTopic(result.topics[0])!,
    messages,
  };
}

export async function deleteTopic({
  chat, topicId,
}: {
  chat: ApiChat;
  topicId: number;
}) {
  const { id, accessHash } = chat;

  const result = await invokeRequest(new GramJs.messages.DeleteTopicHistory({
    peer: buildInputPeer(id, accessHash),
    topMsgId: topicId,
  }));

  if (!result) return;

  processAffectedHistory(chat, result);

  if (result.offset) {
    await deleteTopic({ chat, topicId });
  }
}

export function togglePinnedTopic({
  chat, topicId, isPinned,
}: {
  chat: ApiChat;
  topicId: number;
  isPinned: boolean;
}) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.messages.UpdatePinnedForumTopic({
    peer: buildInputPeer(id, accessHash),
    topicId,
    pinned: isPinned,
  }), {
    shouldReturnTrue: true,
  });
}

export function editTopic({
  chat, topicId, title, iconEmojiId, isClosed, isHidden,
}: {
  chat: ApiChat;
  topicId: number;
  title?: string;
  iconEmojiId?: string;
  isClosed?: boolean;
  isHidden?: boolean;
}) {
  const { id, accessHash } = chat;

  return invokeRequest(new GramJs.messages.EditForumTopic({
    peer: buildInputPeer(id, accessHash),
    topicId,
    title,
    iconEmojiId: topicId !== GENERAL_TOPIC_ID && iconEmojiId ? BigInt(iconEmojiId) : undefined,
    closed: isClosed,
    hidden: isHidden,
  }), {
    shouldReturnTrue: true,
  });
}
