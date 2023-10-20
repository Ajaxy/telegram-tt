/*
It archives all read or muted chats.
Inspired by https://github.com/rebryk/supertelega
See original code here: https://github.com/rebryk/supertelega/blob/master/archive.py
*/

import { getActions, getGlobal } from '../global';

import type { ApiChat } from '../api/types';

import useInterval from './useInterval';

const UPDATE_TIME_SEC = 5;
const MESSAGE_DISPLAY_TIME_SEC = 2 * 60;

export default function useArchiver() {
  const { toggleChatArchived } = getActions();

  const chatsToArchive: { [key: string]: Date } = {};

  const shouldArchive = (chat: ApiChat) => {
    return chat && (chat.isMuted || !(
      chat.hasUnreadMark
      || chat.unreadCount
      || chat.unreadMentionsCount
      || chat.unreadReactionsCount
    ));
  };

  const add = (id: string) => {
    if (id && !chatsToArchive[id]) {
      // eslint-disable-next-line no-console
      console.log('archiver | add chat', id);
      chatsToArchive[id] = new Date();
    }
  };

  const remove = (id: string) => {
    if (id && chatsToArchive[id]) {
      // eslint-disable-next-line no-console
      console.log('archiver | remove chat', id);
      delete chatsToArchive[id];
    }
  };

  const update = () => {
    // eslint-disable-next-line no-console
    console.log('archiver | update');
    const now = new Date();
    const idsToArchive = [];
    for (const [chatId, date] of Object.entries(chatsToArchive)) {
      const duration = Number(now) - Number(date);
      if (duration > MESSAGE_DISPLAY_TIME_SEC * 1000) {
        idsToArchive.push(chatId);
      }
    }
    // eslint-disable-next-line no-console
    console.log('archiver | update idsToArchive', idsToArchive.length);
    for (const id of idsToArchive.slice(0, 5)) {
      toggleChatArchived({ id });
      remove(id);
      // eslint-disable-next-line no-console
      console.log('archiver | toggleChatArchived', id);
    }
  };

  const process = () => {
    // eslint-disable-next-line no-console
    console.log('archiver | process');
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
