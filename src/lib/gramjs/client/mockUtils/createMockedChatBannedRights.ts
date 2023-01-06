import {MockTypes} from "./MockTypes";
import Api from "../../tl/api";

export default function createMockedChatBannedRights(chatId: string, mockData: MockTypes) {
    const channel = mockData.channels.find((channel) => channel.id === chatId);

    if(!channel) throw Error("No such channel " + chatId);

    const {
        bannedRights,
    } = channel;

    return new Api.ChatBannedRights({
        ...bannedRights,
        untilDate: 0,
    })
}
