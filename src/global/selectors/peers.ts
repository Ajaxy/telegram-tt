import type { ApiPeer, ApiSavedGifts, ApiStarGiftCollection } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { isUserId } from '../../util/entities/ids';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { getHasAdminRight, isChatAdmin, isChatChannel, isDeletedUser } from '../helpers';
import { selectChat, selectChatFullInfo, selectIsMonoforumAdmin } from './chats';
import { type ProfileCollectionKey } from './payments';
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

export function selectPeerCollectionSavedGifts<T extends GlobalState>(
  global: T,
  peerId: string,
  collectionId: ProfileCollectionKey,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): ApiSavedGifts | undefined {
  const tabState = selectTabState(global, tabId);
  return tabState.savedGifts.collectionsByPeerId[peerId]?.[collectionId];
}

export function selectPeerSavedGifts<T extends GlobalState>(
  global: T,
  peerId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): ApiSavedGifts | undefined {
  return selectPeerCollectionSavedGifts(global, peerId, 'all', tabId);
}

export function selectPeerStarGiftCollections<T extends GlobalState>(
  global: T,
  peerId: string,
): ApiStarGiftCollection[] | undefined {
  return global.starGiftCollections?.byPeerId[peerId];
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
  if (isChatAdmin(chat) || selectIsMonoforumAdmin(global, chat.id)) return undefined;
  return chat.paidMessagesStars;
}

export function selectPeerHasProfileBackground<T extends GlobalState>(global: T, peerId: string) {
  const peer = selectPeer(global, peerId);
  const profileColor = peer?.profileColor;
  if (profileColor?.type === 'collectible') return true;
  if (profileColor?.type === 'regular') return profileColor.color !== undefined;
  return peer?.emojiStatus?.type === 'collectible';
}

export function selectCanUpdateMainTab<T extends GlobalState>(global: T, peerId: string) {
  if (global.currentUserId === peerId) {
    return true;
  }

  const chat = selectChat(global, peerId);
  return Boolean(chat && isChatChannel(chat) && getHasAdminRight(chat, 'postMessages'));
}
