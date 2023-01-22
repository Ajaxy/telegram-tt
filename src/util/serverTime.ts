let serverTimeOffset = 0;

export function setServerTimeOffset(_serverTimeOffset: number) {
  serverTimeOffset = _serverTimeOffset;
}

export function getServerTimeOffset() {
  return serverTimeOffset;
}

export function getServerTime() {
  return Math.floor(Date.now() / 1000) + serverTimeOffset;
}
