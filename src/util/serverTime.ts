export const getServerTime = (serverTimeOffset: number) => {
  return Math.floor(Date.now() / 1000) + serverTimeOffset;
};
