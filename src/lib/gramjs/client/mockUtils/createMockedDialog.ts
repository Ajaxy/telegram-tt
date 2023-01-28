import Api from '../../tl/api';
import createMockedTypePeer from './createMockedTypePeer';
import type { MockTypes } from './MockTypes';

export default function createMockedDialog(id: string, mockData: MockTypes): Api.Dialog {
    const dialog = mockData.dialogs.active.find((d) => d.id === id)
        || mockData.dialogs.archived.find((d) => d.id === id);

    if (!dialog) throw Error('No such dialog');

    const {
        unreadMentionsCount = 0,
        unreadReactionsCount = 0,
        readInboxMaxId = 0,
        readOutboxMaxId = 0,
        unreadCount = 0,
        topMessage = 0,
    } = dialog;

    return new Api.Dialog({
        peer: createMockedTypePeer(id, mockData),
        topMessage,
        readInboxMaxId,
        readOutboxMaxId,
        unreadCount,
        unreadMentionsCount,
        unreadReactionsCount,
        notifySettings: new Api.PeerNotifySettings({}),
    });
}
