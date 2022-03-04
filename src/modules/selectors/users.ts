import { GlobalState } from '../../global/types';
import { ApiChat, ApiUser, ApiUserStatus } from '../../api/types';

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
