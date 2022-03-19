import { GlobalState } from '../types';
import { selectChat } from './chats';
import { getUserFullName, isChatBasicGroup } from '../helpers';
import { selectUser } from './users';

export function selectChatGroupCall(global: GlobalState, chatId: string) {
  const chat = selectChat(global, chatId);
  if (!chat || !chat.fullInfo || !chat.fullInfo.groupCallId) return undefined;

  return selectGroupCall(global, chat.fullInfo.groupCallId);
}

export function selectGroupCall(global: GlobalState, groupCallId: string) {
  return global.groupCalls.byId[groupCallId];
}

export function selectGroupCallParticipant(global: GlobalState, groupCallId: string, participantId: string) {
  return selectGroupCall(global, groupCallId)?.participants[participantId];
}

export function selectIsAdminInActiveGroupCall(global: GlobalState): boolean {
  const chatId = selectActiveGroupCall(global)?.chatId;

  if (!chatId) return false;

  const chat = selectChat(global, chatId);
  if (!chat) return false;

  return (isChatBasicGroup(chat) && chat.isCreator) || Boolean(chat.adminRights?.manageCall);
}

export function selectActiveGroupCall(global: GlobalState) {
  const { groupCalls: { activeGroupCallId } } = global;
  if (!activeGroupCallId) {
    return undefined;
  }

  return selectGroupCall(global, activeGroupCallId);
}

export function selectCallFallbackChannelTitle(global: GlobalState) {
  const currentUser = selectUser(global, global.currentUserId!);

  return `Calls: ${getUserFullName(currentUser!)}`;
}
