import BigInt from 'big-integer';
import Api from '../../tl/api';
import type { MockTypes } from './MockTypes';

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
        channelId: BigInt(1000000000 + 2),
        // recentRepliers?: Api.TypePeer[];
    });
}
