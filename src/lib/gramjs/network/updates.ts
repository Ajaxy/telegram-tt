export class UpdateConnectionState {
    static disconnected = -1;

    static connected = 1;

    static broken = 0;

    state: number;

    constructor(state: number) {
        this.state = state;
    }
}

export class UpdateServerTimeOffset {
    timeOffset: number;

    constructor(timeOffset: number) {
        this.timeOffset = timeOffset;
    }
}
