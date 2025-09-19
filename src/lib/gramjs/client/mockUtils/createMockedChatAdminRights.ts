import type { MockTypes } from './MockTypes';

import Api from '../../tl/api';

export default function createMockedChatAdminRights(chatId: string, mockData: MockTypes) {
  const channel = mockData.channels.find((c) => c.id === chatId);

  if (!channel) throw Error('No such channel ' + chatId);

  const {
    adminRights,
  } = channel;

  return new Api.ChatAdminRights({
    ...adminRights,
  });
}
