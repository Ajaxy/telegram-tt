import { CHANNEL_ID_LENGTH } from '../../config';

export function isUserId(entityId: string) {
  return !entityId.startsWith('-');
}

export function isChannelId(entityId: string) {
  return entityId.length === CHANNEL_ID_LENGTH && entityId.startsWith('-1');
}

export function toChannelId(mtpId: string) {
  return `-1${mtpId.padStart(CHANNEL_ID_LENGTH - 2, '0')}`;
}

export function getCleanPeerId(peerId: string) {
  return isChannelId(peerId)
    // Remove -1 and leading zeros
    ? peerId.replace(/^-10+/, '')
    : peerId.replace('-', '');
}

export function getPeerIdDividend(peerId: string) {
  return Math.abs(Number(getCleanPeerId(peerId)));
}
