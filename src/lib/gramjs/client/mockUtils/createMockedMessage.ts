import Api from '../../tl/api';
import {MOCK_STARTING_DATE, MockTypes} from "./MockTypes";
import createMockedTypePeer from "./createMockedTypePeer";
import createMockedMessageMedia from "./createMockedMessageMedia";
import createMockedMessageReactions from "./createMockedMessageReactions";
import createMockedReplies from "./createMockedReplies";
import createMockedReplyTo from "./createMockedReplyTo";
import {omit} from "../../../../util/iteratees";

export default function createMockedMessage(chatId: string, id: number, mockData: MockTypes): Api.Message {
    const msg = mockData.messages[chatId].find((message) => message.id === id);

    if(!msg) throw Error("No such message " + id);

    const {
        date = MOCK_STARTING_DATE + id,
        message = "Message",
        media,
        reactions,
        replies,
        replyTo = createMockedReplyTo(chatId, id, mockData),
        ...rest
    } = omit(msg, ['replyToMsgId', 'replyToTopId', 'replyToForumTopic']);

    return new Api.Message({
        ...rest,
        id,
        peerId: createMockedTypePeer(chatId, mockData),
        date,
        message,
        replyTo,
        ...(media ? { media: createMockedMessageMedia(media, mockData) } : undefined),
        ...(reactions ? { reactions: createMockedMessageReactions(chatId, id, mockData) } : undefined),
        ...(replies ? { replies: createMockedReplies(chatId, id, mockData) } : undefined),
    });
}
