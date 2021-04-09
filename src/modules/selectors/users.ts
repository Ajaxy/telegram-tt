import { GlobalState } from '../../global/types';
import { ApiChat, ApiUser } from '../../api/types';

export function selectUser(global: GlobalState, userId: number): ApiUser | undefined {
  return global.users.byId[userId];
}

// Slow, not to be used in `withGlobal`
export function selectUserByUsername(global: GlobalState, username: string) {
  const usernameLowered = username.toLowerCase();
  return Object.values(global.users.byId).find(
    (user) => user.username.toLowerCase() === usernameLowered,
  );
}

export function selectIsUserOrChatContact(global: GlobalState, userOrChat: ApiUser | ApiChat) {
  return global.contactList && global.contactList.userIds.includes(userOrChat.id);
}
