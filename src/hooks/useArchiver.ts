/*
It archives all read or muted chats.
Inspired by https://github.com/rebryk/supertelega
See original code here: https://github.com/rebryk/supertelega/blob/master/archive.py
*/

import { getActions, getGlobal } from '../global';

import type { ApiChat } from '../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../config';
import useInterval from './useInterval';

const UPDATE_TIME_SEC = 5;
const MESSAGE_DISPLAY_TIME_SEC = 60;
const BATCH_SIZE = 5;

export default function useArchiver() {
  const { toggleChatArchived } = getActions();

  const chatsToArchive: { [key: string]: Date } = {};

  const shouldArchive = (chat: ApiChat) => {
    return chat && (chat.isMuted || !(
      chat.id === SERVICE_NOTIFICATIONS_USER_ID // impossible to archive
      || chat.hasUnreadMark
      || chat.unreadCount
      || chat.unreadMentionsCount
      || chat.unreadReactionsCount
    ));
  };

  const add = (chatId: string) => {
    if (chatId && !chatsToArchive[chatId]) {
      chatsToArchive[chatId] = new Date();
    }
  };

  const remove = (chatId: string) => {
    if (chatId && chatsToArchive[chatId]) {
      delete chatsToArchive[chatId];
    }
  };

  const update = () => {
    const now = new Date();
    const idsToArchive = [];
    for (const [chatId, date] of Object.entries(chatsToArchive)) {
      const duration = Number(now) - Number(date);
      if (duration > MESSAGE_DISPLAY_TIME_SEC * 1000) {
        idsToArchive.push(chatId);
      }
    }
    for (const id of idsToArchive.slice(0, BATCH_SIZE)) {
      toggleChatArchived({ id });
      remove(id);
    }
  };

  const process = () => {
    const global = getGlobal();
    const notArchivedChatsIds = global.chats.listIds.active;
    if (notArchivedChatsIds) {
      for (const chatId of notArchivedChatsIds) {
        const chatsById = global.chats.byId;
        const chat = chatsById[chatId];
        if (chat) {
          if (shouldArchive(chat)) {
            add(chat.id);
          } else {
            remove(chat.id);
          }
        }
      }
      update();
    }
  };

  useInterval(() => {
    process();
  }, UPDATE_TIME_SEC * 1000);
}
