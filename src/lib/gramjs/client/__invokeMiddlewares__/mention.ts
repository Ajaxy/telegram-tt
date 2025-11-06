import type TelegramClient from '../MockClient';

import Api from '../../tl/api';
import createMockedMessage from '../mockUtils/createMockedMessage';

export default function<A, R>(mockClient: TelegramClient, request: Api.Request<A, R>) {
  if (request instanceof Api.messages.GetUnreadMentions) {
    return new Api.messages.Messages({
      messages: [
        createMockedMessage('2', 13, mockClient.mockData),
      ],
      chats: [],
      users: [],
      topics: [],
    });
  }
  return 'pass';
}
