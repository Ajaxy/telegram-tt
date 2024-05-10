import { getGlobal } from '../global';

import { GLOBAL_STATE_CACHE_KEY } from '../config';
import {
  selectChat,
  selectChatFolder,
  selectChatFullInfo,
  selectChatLastMessage,
  selectPeer,
  selectUser,
  selectUserFullInfo,
} from '../global/selectors';

export function getChatsInTheFolder(folderId: number) {
  const g = getGlobal();
  const folder = selectChatFolder(g, folderId);
  const ids = folder.includedChatIds;
  return ids.map((id) => ({
    id: parseInt(id, 10),
    chat: selectChat(g, id),
    fullInfo: selectChatFullInfo(g, id),
    peerInfo: selectPeer(g, id),
    msg: selectChatLastMessage(g, id, 'all'),
  }));
}

export function getChatsByIds(chatsIds: number[]) {
  const g = getGlobal();

  const localStorageData = JSON.parse(
    localStorage.getItem(GLOBAL_STATE_CACHE_KEY) || '',
  );

  const fetchedChats = chatsIds.map((chatId) => {
    const id = chatId.toString();
    const chatLastMessage = selectChatLastMessage(localStorageData, id);
    const shortUserInfo = chatLastMessage?.senderId
      ? selectUser(localStorageData, chatLastMessage.senderId)
        || selectUser(g, chatLastMessage.senderId)
      : undefined;
    const userFullInfo = chatLastMessage?.senderId
      ? selectUserFullInfo(g, chatLastMessage.senderId)
      : undefined;

    return {
      chat: selectChat(localStorageData, id) || selectChat(g, id),
      id: chatId,
      chatFullInfo: selectChatFullInfo(localStorageData, id),
      msg: chatLastMessage,
      lastMessageUserInfo: shortUserInfo,
      userFullInfo,
    };
  });

  return g.isSynced ? fetchedChats : undefined;
}

export function getUserById(userId: number) {
  const g = getGlobal();

  const id = userId.toString();

  return {
    userShortInfo: selectUser(g, id),
    userFullInfo: selectUserFullInfo(g, id),
  };
}

export function getChatById(chatId: number) {
  const g = getGlobal();

  const id = chatId.toString();

  return {
    chatShortInfo: selectChat(g, id),
    chatFullInfo: selectChatFullInfo(g, id),
  };
}

export function getAuthInfo():
| { authed: false }
| { authed: true; userId: string } {
  const g = getGlobal();
  const authed = g.authState === 'authorizationStateReady';
  const userId = g.currentUserId;
  if (!authed || !userId) return { authed: false };

  return {
    authed: true,
    userId,
  };
}