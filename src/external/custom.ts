/* eslint-disable no-console */
import { getGlobal } from '../global';

import {
  selectChat,
  selectChatFolder,
  selectChatFullInfo,
  selectChatLastMessage,
  selectPeer,
  selectUser,
  selectUserFullInfo,
} from '../global/selectors';

let isLeftColumnMinimized = true;

export function setLeftColumnMinimized(value: boolean) {
  isLeftColumnMinimized = value;
}

export function getLeftColumnMinimized() {
  return isLeftColumnMinimized;
}

export function getChatsInTheFolder(folderId: number) {
  const g = getGlobal();

  if (!g.chatFolders?.byId?.[folderId]) {
    return undefined;
  }

  const folder = selectChatFolder(g, folderId);

  const ids = folder?.includedChatIds;

  if (!ids?.length) {
    return undefined;
  }

  return ids.map((id) => ({
    id: parseInt(id, 10),
    chat: selectChat(g, id),
    fullInfo: selectChatFullInfo(g, id),
    peerInfo: selectPeer(g, id),
    msg: selectChatLastMessage(g, id, 'all'),
  }));
}

export function getChatWithLastMessageById(chatId: number) {
  const g = getGlobal();

  if (!g.chats?.byId?.[chatId]) {
    return undefined;
  }

  const id = chatId.toString();
  const chatLastMessage = selectChatLastMessage(g, id);
  const userShortInfo = chatLastMessage?.senderId
    ? selectUser(g, chatLastMessage.senderId)
    : undefined;
  const userFullInfo = chatLastMessage?.senderId
    ? selectUserFullInfo(g, chatLastMessage.senderId)
    : undefined;

  const chatData = {
    chat: selectChat(g, id),
    id: chatId,
    chatFullInfo: selectChatFullInfo(g, id),
    msg: chatLastMessage,
    lastMessageUserInfo: userShortInfo,
    userFullInfo,
  };

  return chatData;
}

export function getUserById(userId: number) {
  const g = getGlobal();

  const id = userId.toString();

  if (!g.users?.byId?.[userId]) {
    return undefined;
  }

  return {
    userShortInfo: selectUser(g, id),
    userFullInfo: selectUserFullInfo(g, id),
  };
}

export function getChatById(chatId: number) {
  const g = getGlobal();

  const id = chatId.toString();

  if (!g.chats?.byId?.[chatId]) {
    return undefined;
  }

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

export function openSettingsButton() {
  setLeftColumnMinimized(false);

  const tryCloseMessages = () => {
    if (document.querySelector('.messages-layout')) {
      simulateEscapeKeyPress();
      // Use setTimeout to avoid blocking the main thread
      setTimeout(tryCloseMessages, 100);
    } else {
      const settingsButton = document.querySelector('.MenuItem.compact .icon.icon-settings');
      if (settingsButton) {
        (settingsButton as HTMLElement).click();
      } else {
        console.error('Settings button not found');
      }
    }
  };

  tryCloseMessages();
}

export function simulateEscapeKeyPress() {
  const event = new KeyboardEvent('keydown', {
    key: 'ScrollLock',
    code: 'ScrollLock',
    keyCode: 145,
    which: 145,
    bubbles: true,
    cancelable: true,
  });

  document.dispatchEvent(event);
}

export function findChatByTitle(searchTitle: string) {
  const g = getGlobal();

  // Case insensitive search
  const normalizedSearch = searchTitle.toLowerCase().trim();

  // Find the first chat that matches the title
  const foundChat = Object.values(g.chats?.byId || {}).find((chat) => chat.title?.toLowerCase().includes(normalizedSearch));

  if (!foundChat) {
    return undefined;
  }

  // Return in the same format as getChatWithLastMessageById
  const id = foundChat.id.toString();
  const chatLastMessage = selectChatLastMessage(g, id);
  const userShortInfo = chatLastMessage?.senderId
    ? selectUser(g, chatLastMessage.senderId)
    : undefined;
  const userFullInfo = chatLastMessage?.senderId
    ? selectUserFullInfo(g, chatLastMessage.senderId)
    : undefined;

  return {
    chat: selectChat(g, id),
    id: Number(foundChat.id),
    chatFullInfo: selectChatFullInfo(g, id),
    msg: chatLastMessage,
    lastMessageUserInfo: userShortInfo,
    userFullInfo,
  };
}
