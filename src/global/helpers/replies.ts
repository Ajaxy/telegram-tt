import type { ApiMessage, ApiMessageReplyInfo, ApiStoryReplyInfo } from '../../api/types';

export function getMessageReplyInfo(message: ApiMessage): ApiMessageReplyInfo | undefined {
  const { replyInfo } = message;
  if (!replyInfo || replyInfo.type !== 'message') return undefined;
  return replyInfo;
}

export function getStoryReplyInfo(message: ApiMessage): ApiStoryReplyInfo | undefined {
  const { replyInfo } = message;
  if (!replyInfo || replyInfo.type !== 'story') return undefined;
  return replyInfo;
}
