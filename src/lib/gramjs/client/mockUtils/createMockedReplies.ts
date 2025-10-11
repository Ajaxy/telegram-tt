import type { MockTypes } from './MockTypes';

import { CHANNEL_ID_BASE } from '../../../../config';
import Api from '../../tl/api';

export default function createMockedReplies(chatId: string, id: number, mockData: MockTypes) {
  const msg = mockData.messages[chatId].find((message) => message.id === id);

  if (!msg) throw Error(`No such message ${id}`);

  const {
    replies,
  } = msg;

  if (!replies) throw Error(`No replies on message ${id}`);

  return new Api.MessageReplies({
    comments: true,
    replies: replies.replies,
    repliesPts: 1,
    channelId: -2n - CHANNEL_ID_BASE,
    // recentRepliers?: Api.TypePeer[];
  });
}
