import Api from "../../tl/api";
import BigInt from "big-integer";
import {MockTypes} from "./MockTypes";

export default function createMockedTypePeer(id: string, mockData: MockTypes): Api.TypePeer {
    const user = mockData.users.find((user) => user.id === id);
    if(user) {
        return new Api.PeerUser({
            userId: BigInt(id),
        })
    }

    const chat = mockData.chats.find((chat) => chat.id === id);
    if(chat) {
        return new Api.PeerChat({
            chatId: BigInt(id),
        })
    }

    const channel = mockData.channels.find((channel) => channel.id === id);
    if(channel) {
        return new Api.PeerChannel({
            channelId: BigInt(Number(id) + 1000000000),
        })
    }

    throw Error("No such peer " + id);
}
