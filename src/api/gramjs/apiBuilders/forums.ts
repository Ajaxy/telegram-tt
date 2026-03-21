import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiTopic, ApiTopicWithState } from '../../types';

import { buildThreadReadState } from './chats';
import { buildApiPeerNotifySettings, getApiChatIdFromMtpPeer } from './peers';

function buildApiTopic(forumTopic: GramJs.TypeForumTopic): ApiTopic | undefined {
  if (forumTopic instanceof GramJs.ForumTopicDeleted) {
    return undefined;
  }

  const {
    id,
    my,
    closed,
    pinned,
    hidden,
    short,
    date,
    title,
    iconColor,
    iconEmojiId,
    fromId,
    notifySettings,
    titleMissing,
  } = forumTopic;

  return {
    id,
    isClosed: closed,
    isPinned: pinned,
    isHidden: hidden,
    isOwner: my,
    isMin: short,
    date,
    title,
    iconColor,
    iconEmojiId: iconEmojiId?.toString(),
    fromId: getApiChatIdFromMtpPeer(fromId),
    notifySettings: buildApiPeerNotifySettings(notifySettings),
    isTitleMissing: titleMissing,
  };
}

export function buildApiTopicWithState(forumTopic: GramJs.TypeForumTopic): ApiTopicWithState | undefined {
  if (forumTopic instanceof GramJs.ForumTopicDeleted) {
    return undefined;
  }

  const topic = buildApiTopic(forumTopic);
  if (!topic) return undefined;
  const isMin = topic.isMin;

  return {
    topic,
    readState: !isMin ? buildThreadReadState(forumTopic) : undefined,
    lastMessageId: !isMin ? forumTopic.topMessage : undefined,
  };
}
