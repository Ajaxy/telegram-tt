import Api from "../../tl/api";
import createMockedTypePeer from "./createMockedTypePeer";
import {MockDialog, MockTypes} from "./MockTypes";

export default function createMockedDialog({
    id,
}: MockDialog, mockData: MockTypes): Api.Dialog {
    return new Api.Dialog({
        peer: createMockedTypePeer(id, mockData),
        topMessage: 0,
        readInboxMaxId: 0,
        readOutboxMaxId: 0,
        unreadCount: 0,
        unreadMentionsCount: 0,
        unreadReactionsCount: 0,
        notifySettings: new Api.PeerNotifySettings({}),
    });
}
