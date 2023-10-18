/*
Archives all read or muted chats
Inspired by https://github.com/rebryk/supertelega
See original code here: https://github.com/rebryk/supertelega/blob/master/archive.py
*/

import { useState } from '../lib/teact/teact';
import { getGlobal } from '../global';

import type { ApiChat } from '../api/types';

import useInterval from './useInterval';

const UPDATE_TIME_SEC = 5;
const MESSAGE_DISPLAY_TIME_SEC = 6;

export default function useArchiver() {
  const [isBusy, setIsBusy] = useState(false);
  const global = getGlobal();

  const chatsToArchive: { [key: string]: Date } = {};

  const shouldArchive = (chat: ApiChat) => {
    return chat.isMuted || !(
      chat.hasUnreadMark
      || chat.unreadCount
      || chat.unreadMentionsCount
      || chat.unreadReactionsCount
    );
  };

  const add = (chat: ApiChat) => {
    if (!chatsToArchive[chat.id]) {
      chatsToArchive[chat.id] = new Date();
    }
  };

  const remove = (chat: ApiChat) => {
    delete chatsToArchive[chat.id];
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
    for (const chatId of idsToArchive) {
      idsToArchive.pop();
      // eslint-disable-next-line no-console
      console.log('Archive', chatId);
    }
  };

  const process = () => {
    // eslint-disable-next-line no-console
    console.log('Archive process');
    setIsBusy(true);
    const notArchivedChatsIds = global.chats.listIds.active;
    if (notArchivedChatsIds) {
      for (let i = 0; i < 10; i++) {
        const chatId = notArchivedChatsIds[i];
        const chatsById = global.chats.byId;
        const chat = chatsById[chatId];
        if (shouldArchive(chat)) {
          add(chat);
          // eslint-disable-next-line no-console
          console.log('Archive Add chat', chat.id);
        } else {
          remove(chat);
        }
        update();

        // eslint-disable-next-line no-console
        // console.log('Archiver', chatId, chat.hasUnreadMark);
      }
    }
    setIsBusy(false);
  };

  useInterval(() => {
    if (!isBusy) {
      process();
    }
  }, UPDATE_TIME_SEC * 1000);
}
