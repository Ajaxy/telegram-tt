import Api from '../../tl/api';
import type { MockTypes } from './MockTypes';
import { MOCK_STARTING_DATE } from './MockTypes';
import createMockedTypePeer from './createMockedTypePeer';
import createMockedMessageMedia from './createMockedMessageMedia';
import createMockedMessageReactions from './createMockedMessageReactions';
import createMockedReplies from './createMockedReplies';
import createMockedReplyTo from './createMockedReplyTo';
import { omit } from '../../../../util/iteratees';

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
        entities = [new Api.MessageEntityMention({ offset: 0, length: 5 })],
        ...rest
    } = omit(msg, ['replyToMsgId', 'replyToTopId', 'replyToForumTopic']);

    return new Api.Message({
        ...rest,
        id,
        peerId: createMockedTypePeer(chatId, mockData),
        date,
        message,
        entities,
        replyTo,
        ...(media ? { media: createMockedMessageMedia(media, mockData) } : undefined),
        ...(reactions ? { reactions: createMockedMessageReactions(chatId, id, mockData) } : undefined),
        ...(replies ? { replies: createMockedReplies(chatId, id, mockData) } : undefined),
    });
}
