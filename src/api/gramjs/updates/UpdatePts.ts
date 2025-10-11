export class LocalUpdatePts {
  constructor(public pts: number, public ptsCount: number) {}
}

export class LocalUpdateChannelPts {
  constructor(public channelId: bigint, public pts: number, public ptsCount: number) {}
}

export type UpdatePts = LocalUpdatePts | LocalUpdateChannelPts;

export function buildLocalUpdatePts(pts: number, ptsCount: number, channelId?: bigint) {
  return channelId ? new LocalUpdateChannelPts(channelId, pts, ptsCount) : new LocalUpdatePts(pts, ptsCount);
}
