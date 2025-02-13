import type { ApiPeer, ApiSavedGifts } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectChat, selectChatFullInfo } from './chats';
import { selectTabState } from './tabs';
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

  const areStarGiftsAvailable = selectChatFullInfo(global, peerId)?.areStarGiftsAvailable || user;

  return Boolean(!selectIsPremiumPurchaseBlocked(global) && !bot && peerId !== SERVICE_NOTIFICATIONS_USER_ID
    && areStarGiftsAvailable);
}

export function selectPeerSavedGifts<T extends GlobalState>(
  global: T,
  peerId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) : ApiSavedGifts {
  return selectTabState(global, tabId).savedGifts.giftsByPeerId[peerId];
}
