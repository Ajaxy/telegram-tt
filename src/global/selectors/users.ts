import type {
  ApiPeer, ApiUser, ApiUserFullInfo, ApiUserStatus,
} from '../../api/types';
import type { GlobalState } from '../types';

import { isUserBot } from '../helpers';

export function selectUser<T extends GlobalState>(global: T, userId: string): ApiUser | undefined {
  return global.users.byId[userId];
}

export function selectUserStatus<T extends GlobalState>(global: T, userId: string): ApiUserStatus | undefined {
  return global.users.statusesById[userId];
}

export function selectUserFullInfo<T extends GlobalState>(global: T, userId: string): ApiUserFullInfo | undefined {
  return global.users.fullInfoById[userId];
}

export function selectIsUserBlocked<T extends GlobalState>(global: T, userId: string) {
  return selectUserFullInfo(global, userId)?.isBlocked;
}

export function selectIsCurrentUserPremium<T extends GlobalState>(global: T) {
  if (!global.currentUserId) return false;

  return Boolean(global.users.byId[global.currentUserId].isPremium);
}

export function selectIsPremiumPurchaseBlocked<T extends GlobalState>(global: T) {
  return global.appConfig?.isPremiumPurchaseBlocked ?? true;
}

// Slow, not to be used in `withGlobal`
export function selectUserByPhoneNumber<T extends GlobalState>(global: T, phoneNumber: string) {
  const phoneNumberCleaned = phoneNumber.replace(/[^0-9]/g, '');

  return Object.values(global.users.byId).find((user) => user?.phoneNumber === phoneNumberCleaned);
}

export function selectIsUserOrChatContact<T extends GlobalState>(global: T, peer: ApiPeer) {
  return global.contactList && global.contactList.userIds.includes(peer.id);
}

export function selectBot<T extends GlobalState>(global: T, userId: string): ApiUser | undefined {
  const user = selectUser(global, userId);
  if (!user || !isUserBot(user)) {
    return undefined;
  }

  return user;
}
