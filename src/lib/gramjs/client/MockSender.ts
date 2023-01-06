import type MockClient from './MockClient';

export default class MockSender {
    constructor(private mockClient: MockClient) {
    }

    send(request: any) {
        return this.mockClient.invoke(request);
    }

    isConnected() {
        return true;
    }
}
