import type { MockTypes } from './MockTypes';

import { omit } from '../../../../util/iteratees';
import Api from '../../tl/api';
import createMockedMessageMedia from './createMockedMessageMedia';
import createMockedMessageReactions from './createMockedMessageReactions';
import createMockedReplies from './createMockedReplies';
import createMockedReplyTo from './createMockedReplyTo';
import createMockedTypePeer from './createMockedTypePeer';

import { MOCK_STARTING_DATE } from './MockTypes';

export default function createMockedMessage(chatId: string, id: number, mockData: MockTypes): Api.Message {
  const msg = mockData.messages[chatId].find((message) => message.id === id);

  if (!msg) throw Error(`No such message ${id}`);

  const {
    date = MOCK_STARTING_DATE + id,
    message = 'Message',
    media,
    reactions,
    replies,
    replyTo = createMockedReplyTo(chatId, id, mockData),
    entities = [{ type: 'mention', offset: 0, length: 5 }],
    fromUserId,
    ...rest
  } = omit(msg, ['replyToMsgId', 'replyToTopId', 'replyToForumTopic']);

  return new Api.Message({
    ...rest,
    id,
    peerId: createMockedTypePeer(chatId, mockData),
    date,
    message,
    entities: entities.map(({ type, offset, length }) => (
      type === 'url'
        ? new Api.MessageEntityUrl({ offset, length })
        : new Api.MessageEntityMention({ offset, length })
    )),
    replyTo,
    ...(fromUserId ? { fromId: new Api.PeerUser({ userId: BigInt(fromUserId) }) } : undefined),
    ...(media ? { media: createMockedMessageMedia(media, mockData) } : undefined),
    ...(reactions ? { reactions: createMockedMessageReactions(chatId, id, mockData) } : undefined),
    ...(replies ? { replies: createMockedReplies(chatId, id, mockData) } : undefined),
  });
}
