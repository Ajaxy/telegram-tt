import type { ApiPeer, ApiSavedGifts } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { isChatAdmin, isDeletedUser, isUserId } from '../helpers';
import { selectChat, selectChatFullInfo } from './chats';
import { selectTabState } from './tabs';
import { selectBot, selectUser, selectUserFullInfo } from './users';

export function selectPeer<T extends GlobalState>(global: T, peerId: string): ApiPeer | undefined {
  return selectUser(global, peerId) || selectChat(global, peerId);
}

export function selectPeerPhotos<T extends GlobalState>(global: T, peerId: string) {
  return global.peers.profilePhotosById[peerId];
}

export function selectCanGift<T extends GlobalState>(global: T, peerId: string) {
  const bot = selectBot(global, peerId);
  const user = selectUser(global, peerId);

  if (user) {
    return !bot && peerId !== SERVICE_NOTIFICATIONS_USER_ID && !isDeletedUser(user);
  }

  return selectChatFullInfo(global, peerId)?.areStarGiftsAvailable;
}

export function selectPeerSavedGifts<T extends GlobalState>(
  global: T,
  peerId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) : ApiSavedGifts {
  return selectTabState(global, tabId).savedGifts.giftsByPeerId[peerId];
}

export function selectPeerPaidMessagesStars<T extends GlobalState>(
  global: T,
  peerId: string,
) {
  const isChatWithUser = isUserId(peerId);
  if (isChatWithUser) {
    const userFullInfo = isChatWithUser ? selectUserFullInfo(global, peerId) : undefined;
    return userFullInfo?.paidMessagesStars;
  }

  const chat = selectChat(global, peerId);
  if (!chat) return undefined;
  if (isChatAdmin(chat)) return undefined;
  return chat.paidMessagesStars;
}
