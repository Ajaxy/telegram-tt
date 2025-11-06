import type { MockTypes } from './MockTypes';

import Api from '../../tl/api';
import createMockedTypePeer from './createMockedTypePeer';

import { MOCK_STARTING_DATE } from './MockTypes';

export default function createMockedForumTopic(chatId: string, topicId: number, mockData: MockTypes) {
  const channel = mockData.channels.find((c) => c.id === chatId);

  if (!channel) throw Error(`No such channel ${chatId}`);

  const forumTopic = channel.forumTopics?.find((ft) => ft.id === topicId);

  if (!forumTopic) throw Error(`No such forum topic ${topicId}`);

  const {
    notifySettings = new Api.PeerNotifySettings({}),
    date = MOCK_STARTING_DATE,
    title = 'Topic',
    iconColor = 0x6FB9F0,
    readInboxMaxId = 0,
    readOutboxMaxId = 0,
    unreadCount = 0,
    unreadMentionsCount = 0,
    unreadReactionsCount = 0,
    ...rest
  } = forumTopic;

  return new Api.ForumTopic({
    notifySettings,
    date,
    title,
    iconColor,
    readInboxMaxId,
    readOutboxMaxId,
    unreadCount,
    unreadMentionsCount,
    unreadReactionsCount,
    fromId: createMockedTypePeer(chatId, mockData),
    peer: createMockedTypePeer(chatId, mockData),
    ...rest,
  });
}
