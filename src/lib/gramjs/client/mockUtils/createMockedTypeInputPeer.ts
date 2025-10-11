import type { MockTypes } from './MockTypes';

import { CHANNEL_ID_BASE } from '../../../../config';
import Api from '../../tl/api';

export default function createMockedTypeInputPeer(id: string, mockData: MockTypes): Api.TypeInputPeer {
  const user = mockData.users.find((u) => u.id === id);
  if (user) {
    return new Api.InputPeerUser({
      userId: BigInt(id),
      accessHash: 1n,
    });
  }

  const chat = mockData.chats.find((c) => c.id === id);
  if (chat) {
    return new Api.InputPeerChat({
      chatId: BigInt(id),
    });
  }

  const channel = mockData.channels.find((c) => c.id === id);
  if (channel) {
    return new Api.InputPeerChannel({
      channelId: -BigInt(id) - CHANNEL_ID_BASE,
      accessHash: 1n,
    });
  }

  throw Error('No such peer ' + id);
}
