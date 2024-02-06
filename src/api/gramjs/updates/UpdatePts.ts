/* eslint-disable max-classes-per-file */
import type { BigInteger } from 'big-integer';

export class LocalUpdatePts {
  constructor(public pts: number, public ptsCount: number) {}
}

export class LocalUpdateChannelPts {
  constructor(public channelId: BigInteger, public pts: number, public ptsCount: number) {}
}

export type UpdatePts = LocalUpdatePts | LocalUpdateChannelPts;

export function buildLocalUpdatePts(pts: number, ptsCount: number, channelId?: BigInteger) {
  return channelId ? new LocalUpdateChannelPts(channelId, pts, ptsCount) : new LocalUpdatePts(pts, ptsCount);
}
