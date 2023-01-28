import type { GlobalState } from '../types';
import type { ApiChat, ApiUser, ApiUserStatus } from '../../api/types';
import { isUserBot } from '../helpers';

export function selectUser<T extends GlobalState>(global: T, userId: string): ApiUser | undefined {
  return global.users.byId[userId];
}

export function selectUserStatus<T extends GlobalState>(global: T, userId: string): ApiUserStatus | undefined {
  return global.users.statusesById[userId];
}

export function selectIsUserBlocked<T extends GlobalState>(global: T, userId: string) {
  const user = selectUser(global, userId);

  return user?.fullInfo?.isBlocked;
}

export function selectIsCurrentUserPremium<T extends GlobalState>(global: T) {
  if (!global.currentUserId) return false;

  return Boolean(global.users.byId[global.currentUserId].isPremium);
}

export function selectIsPremiumPurchaseBlocked<T extends GlobalState>(global: T) {
  return global.appConfig?.isPremiumPurchaseBlocked ?? true;
}

// Slow, not to be used in `withGlobal`
export function selectUserByUsername<T extends GlobalState>(global: T, username: string) {
  const usernameLowered = username.toLowerCase();
  return Object.values(global.users.byId).find(
    (user) => user.usernames?.some((u) => u.username.toLowerCase() === usernameLowered),
  );
}

// Slow, not to be used in `withGlobal`
export function selectUserByPhoneNumber<T extends GlobalState>(global: T, phoneNumber: string) {
  const phoneNumberCleaned = phoneNumber.replace(/[^0-9]/g, '');

  return Object.values(global.users.byId).find((user) => user?.phoneNumber === phoneNumberCleaned);
}

export function selectIsUserOrChatContact<T extends GlobalState>(global: T, userOrChat: ApiUser | ApiChat) {
  return global.contactList && global.contactList.userIds.includes(userOrChat.id);
}

export function selectBot<T extends GlobalState>(global: T, userId: string): ApiUser | undefined {
  const user = selectUser(global, userId);
  if (!user || !isUserBot(user)) {
    return undefined;
  }

  return user;
}
