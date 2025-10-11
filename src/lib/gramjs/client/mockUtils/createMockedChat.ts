import type { MockTypes } from './MockTypes';

import Api from '../../tl/api';

import { MOCK_STARTING_DATE } from './MockTypes';

export default function createMockedChat(id: string, mockData: MockTypes): Api.Chat {
  const chat = mockData.chats.find((c) => c.id === id);

  if (!chat) throw Error('No such chat ' + id);

  const {
    title = 'Chat',
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
