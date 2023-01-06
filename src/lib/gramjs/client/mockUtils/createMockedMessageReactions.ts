import Api from "../../tl/api";
import {MockMessageReactions, MockTypes} from "./MockTypes";

export default function createMockedMessageReactions(chatId: string, id: number, mockData: MockTypes) {
    const msg = mockData.messages[chatId].find((message) => message.id === id);

    if(!msg) throw Error("No such message " + id);

    const {
        reactions,
    } = msg;

    if(!reactions) throw Error("No reactions on message " + id);

    return new Api.MessageReactions({
        results: reactions.results.map((r) => new Api.ReactionCount({
            reaction: new Api.ReactionEmoji({
                emoticon: r.emoticon
            }),
            count: r.count,
        })),
        recentReactions: [],
        canSeeList: true,
    })
}
