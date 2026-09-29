import type {
  ApiEphemeralReplyInfo, ApiMessage, ApiMessageReplyInfo, ApiStoryReplyInfo,
} from '../../api/types';

import { GENERAL_TOPIC_ID } from '../../config';

export function getMessageForumTopicId(message: ApiMessage): number {
  if (message.content.action?.type === 'topicCreate') {
    return message.id;
  }

  const { replyToMsgId, replyToTopId, isForumTopic } = getMessageReplyInfo(message) || {};
  if (!isForumTopic) return GENERAL_TOPIC_ID;

  return replyToTopId || replyToMsgId || GENERAL_TOPIC_ID;
}

export function getMessageReplyInfo(message: ApiMessage): ApiMessageReplyInfo | undefined {
  const { replyInfo } = message;
  if (!replyInfo || replyInfo.type !== 'message') return undefined;
  return replyInfo;
}

export function getEphemeralReplyInfo(message: ApiMessage): ApiEphemeralReplyInfo | undefined {
  const { replyInfo } = message;
  if (!replyInfo || replyInfo.type !== 'ephemeral') return undefined;
  return replyInfo;
}

export function getStoryReplyInfo(message: ApiMessage): ApiStoryReplyInfo | undefined {
  const { replyInfo } = message;
  if (!replyInfo || replyInfo.type !== 'story') return undefined;
  return replyInfo;
}
