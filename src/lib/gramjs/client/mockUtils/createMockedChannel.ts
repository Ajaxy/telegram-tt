import type { MockTypes } from './MockTypes';

import { CHANNEL_ID_BASE } from '../../../../config';
import Api from '../../tl/api';
import createMockedChatAdminRights from './createMockedChatAdminRights';
import createMockedChatBannedRights from './createMockedChatBannedRights';

import { MOCK_STARTING_DATE } from './MockTypes';

export default function createMockedChannel(id: string, mockData: MockTypes): Api.Channel {
  const channel = mockData.channels.find((c) => c.id === id);

  if (!channel) throw Error('No such channel ' + id);

  const {
    accessHash = 1n,
    title = 'Channel',
    date = MOCK_STARTING_DATE,
    bannedRights = createMockedChatBannedRights(id, mockData),
    adminRights = createMockedChatAdminRights(id, mockData),
    ...rest
  } = channel;

  return new Api.Channel({
    ...rest,
    id: -BigInt(id) - CHANNEL_ID_BASE,
    accessHash,
    title,
    bannedRights,
    adminRights,
    photo: new Api.ChatPhotoEmpty(),
    date,
  });
}
