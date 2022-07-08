import type { GlobalState } from '../types';
import type { ApiChat, ApiUser, ApiUserStatus } from '../../api/types';
import { isUserBot } from '../helpers';

export function selectUser(global: GlobalState, userId: string): ApiUser | undefined {
  return global.users.byId[userId];
}

export function selectUserStatus(global: GlobalState, userId: string): ApiUserStatus | undefined {
  return global.users.statusesById[userId];
}

export function selectIsUserBlocked(global: GlobalState, userId: string) {
  const user = selectUser(global, userId);

  return user?.fullInfo?.isBlocked;
}

export function selectIsCurrentUserPremium(global: GlobalState) {
  if (!global.currentUserId) return false;

  return Boolean(global.users.byId[global.currentUserId].isPremium);
}

export function selectIsPremiumPurchaseBlocked(global: GlobalState) {
  return global.appConfig?.isPremiumPurchaseBlocked ?? true;
}

// Slow, not to be used in `withGlobal`
export function selectUserByUsername(global: GlobalState, username: string) {
  const usernameLowered = username.toLowerCase();
  return Object.values(global.users.byId).find(
    (user) => user.username.toLowerCase() === usernameLowered,
  );
}

// Slow, not to be used in `withGlobal`
export function selectUserByPhoneNumber(global: GlobalState, phoneNumber: string) {
  const phoneNumberCleaned = phoneNumber.replace(/[^0-9]/g, '');

  return Object.values(global.users.byId).find((user) => user?.phoneNumber === phoneNumberCleaned);
}

export function selectIsUserOrChatContact(global: GlobalState, userOrChat: ApiUser | ApiChat) {
  return global.contactList && global.contactList.userIds.includes(userOrChat.id);
}

export function selectBot(global: GlobalState, userId: string): ApiUser | undefined {
  const user = selectUser(global, userId);
  if (!user || !isUserBot(user)) {
    return undefined;
  }

  return user;
}
