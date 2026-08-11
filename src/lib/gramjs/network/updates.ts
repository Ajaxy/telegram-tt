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

export class UpdateSessionGap {
  firstMsgId: bigint;

  uniqueId: bigint;

  constructor(firstMsgId: bigint, uniqueId: bigint) {
    this.firstMsgId = firstMsgId;
    this.uniqueId = uniqueId;
  }
}
