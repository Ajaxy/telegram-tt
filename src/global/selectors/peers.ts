import type { ApiPeer } from '../../api/types';
import type { GlobalState } from '../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { selectChat, selectChatFullInfo } from './chats';
import { selectBot, selectIsPremiumPurchaseBlocked, selectUser } from './users';

export function selectPeer<T extends GlobalState>(global: T, peerId: string): ApiPeer | undefined {
  return selectUser(global, peerId) || selectChat(global, peerId);
}

export function selectPeerPhotos<T extends GlobalState>(global: T, peerId: string) {
  return global.peers.profilePhotosById[peerId];
}

export function selectCanGift<T extends GlobalState>(global: T, peerId: string) {
  const bot = selectBot(global, peerId);
  const user = selectUser(global, peerId);
  const chat = selectChat(global, peerId);

  const areStarGiftsAvailable = chat ? selectChatFullInfo(global, peerId)?.areStarGiftsAvailable : user;

  return Boolean(!selectIsPremiumPurchaseBlocked(global) && !bot && peerId !== SERVICE_NOTIFICATIONS_USER_ID
    && areStarGiftsAvailable);
}
