import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiTopic } from '../../types';

import { buildApiPeerNotifySettings, getApiChatIdFromMtpPeer } from './peers';

export function buildApiTopic(forumTopic: GramJs.TypeForumTopic): ApiTopic | undefined {
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
    topMessage,
    unreadCount,
    unreadMentionsCount,
    unreadReactionsCount,
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
    lastMessageId: topMessage,
    unreadCount,
    unreadMentionsCount,
    unreadReactionsCount,
    fromId: getApiChatIdFromMtpPeer(fromId),
    notifySettings: buildApiPeerNotifySettings(notifySettings),
    isTitleMissing: titleMissing,
  };
}
