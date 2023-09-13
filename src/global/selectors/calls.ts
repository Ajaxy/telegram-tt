import type { GlobalState } from '../types';

import { getMainUsername, isChatBasicGroup } from '../helpers';
import { selectChat, selectChatFullInfo } from './chats';
import { selectUser } from './users';

export function selectChatGroupCall<T extends GlobalState>(global: T, chatId: string) {
  const fullInfo = selectChatFullInfo(global, chatId);
  if (!fullInfo || !fullInfo.groupCallId) return undefined;

  return selectGroupCall(global, fullInfo.groupCallId);
}

export function selectGroupCall<T extends GlobalState>(global: T, groupCallId: string) {
  return global.groupCalls.byId[groupCallId];
}

export function selectGroupCallParticipant<T extends GlobalState>(
  global: T, groupCallId: string, participantId: string,
) {
  return selectGroupCall(global, groupCallId)?.participants[participantId];
}

export function selectIsAdminInActiveGroupCall<T extends GlobalState>(global: T): boolean {
  const chatId = selectActiveGroupCall(global)?.chatId;

  if (!chatId) return false;

  const chat = selectChat(global, chatId);
  if (!chat) return false;

  return (isChatBasicGroup(chat) && chat.isCreator) || Boolean(chat.adminRights?.manageCall);
}

export function selectActiveGroupCall<T extends GlobalState>(global: T) {
  const { groupCalls: { activeGroupCallId } } = global;
  if (!activeGroupCallId) {
    return undefined;
  }

  return selectGroupCall(global, activeGroupCallId);
}

export function selectPhoneCallUser<T extends GlobalState>(global: T) {
  const { phoneCall, currentUserId } = global;
  if (!phoneCall || !phoneCall.participantId || !phoneCall.adminId) {
    return undefined;
  }

  const id = phoneCall.adminId === currentUserId ? phoneCall.participantId : phoneCall.adminId;
  return selectUser(global, id);
}

export function selectCanInviteToActiveGroupCall<T extends GlobalState>(global: T) {
  const groupCall = selectActiveGroupCall(global);

  if (!groupCall || !groupCall.chatId) {
    return false;
  }

  const chat = selectChat(global, groupCall.chatId);
  if (!chat) {
    return false;
  }

  const hasPublicUsername = Boolean(getMainUsername(chat));
  if (hasPublicUsername) {
    return true;
  }

  const inviteLink = selectChatFullInfo(global, chat.id)?.inviteLink;
  return Boolean(inviteLink);
}
