import Api from '../../tl/api';
import BigInt from "big-integer";
import {MOCK_STARTING_DATE, MockTypes} from "./MockTypes";

export default function createMockedChat(id: string, mockData: MockTypes): Api.Chat {
    const chat = mockData.chats.find((chat) => chat.id === id);

    if(!chat) throw Error("No such chat " + id);

    const {
        title = "Chat",
        participantsCount = 1,
        version = 0,
        date = MOCK_STARTING_DATE,
        ...rest
    } = chat;

    return new Api.Chat({
        ...rest,
        id: BigInt(id),
        title,
        photo: new Api.ChatPhotoEmpty(),
        participantsCount,
        date,
        version,
    });
}
