import Api from '../../tl/api';
import type TelegramClient from '../MockClient';
import createMockedMessage from '../mockUtils/createMockedMessage';

export default async function<A, R>(mockClient: TelegramClient, request: Api.Request<A, R>) {
    if (request instanceof Api.messages.GetUnreadMentions) {
        return new Api.messages.Messages({
            messages: [
                createMockedMessage('2', 13, mockClient.mockData),
            ],
            chats: [],
            users: [],
        });
    }
    return 'pass';
}
