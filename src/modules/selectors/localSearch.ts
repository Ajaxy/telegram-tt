import { GlobalState } from '../../global/types';
import { selectCurrentMessageList } from './messages';
import { buildChatThreadKey } from '../helpers';

export function selectCurrentTextSearch(global: GlobalState) {
  const { chatId, threadId } = selectCurrentMessageList(global) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const currentSearch = global.localTextSearch.byChatThreadKey[chatThreadKey];
  if (!currentSearch || !currentSearch.isActive) {
    return undefined;
  }

  return currentSearch;
}

export function selectCurrentMediaSearchPeerId(global: GlobalState) {
  const { byChatId } = global.localMediaSearch;
  const { chatId } = selectCurrentMessageList(global) || {};
  const currentProfileUserId = global.users.selectedId;

  return currentProfileUserId && byChatId[currentProfileUserId] ? currentProfileUserId : chatId;
}

export function selectCurrentMediaSearch(global: GlobalState) {
  const peerId = selectCurrentMediaSearchPeerId(global);
  if (!peerId) {
    return undefined;
  }

  return global.localMediaSearch.byChatId[peerId];
}
