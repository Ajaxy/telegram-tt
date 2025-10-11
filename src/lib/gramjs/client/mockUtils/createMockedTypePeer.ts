import type { MockTypes } from './MockTypes';

import { CHANNEL_ID_BASE } from '../../../../config';
import Api from '../../tl/api';

export default function createMockedTypePeer(id: string, mockData: MockTypes): Api.TypePeer {
  const user = mockData.users.find((u) => u.id === id);
  if (user) {
    return new Api.PeerUser({
      userId: BigInt(id),
    });
  }

  const chat = mockData.chats.find((c) => c.id === id);
  if (chat) {
    return new Api.PeerChat({
      chatId: BigInt(id),
    });
  }

  const channel = mockData.channels.find((c) => c.id === id);
  if (channel) {
    return new Api.PeerChannel({
      channelId: -BigInt(id) - CHANNEL_ID_BASE,
    });
  }

  throw Error('No such peer ' + id);
}
