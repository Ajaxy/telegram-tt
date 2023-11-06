/*
It archives all read or muted chats.
Inspired by https://github.com/rebryk/supertelega
See original code here: https://github.com/rebryk/supertelega/blob/master/archive.py
*/

import { getActions, getGlobal } from '../global';

import type { ApiChat } from '../api/types';
import type { GlobalState } from '../global/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../config';
import useInterval from './useInterval';

const UPDATE_TIME_SEC = 3;
const MESSAGE_DISPLAY_TIME_SEC = 60;
const BATCH_SIZE = 5;
const SEC_24H = 60 * 60 * 24;

export default function useArchiver({ isAutoarchiverMode }: { isAutoarchiverMode: boolean }) {
  const { toggleChatArchived } = getActions();

  const chatsToArchive: { [key: string]: Date } = {};

  const shouldArchive = (chat: ApiChat, global: GlobalState) => {
    const pinnedChatIds = global.chats.orderedPinnedIds.active;
    const isPinnedInAllFolder = Boolean(pinnedChatIds?.includes(chat.id));
    return chat && !isPinnedInAllFolder && (chat.isMuted || !(
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

  const autoarchive = () => {
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

  const processAutoarchiver = () => {
    const global = getGlobal();
    const notArchivedChatsIds = global.chats.listIds.active;
    if (!notArchivedChatsIds) {
      return;
    }
    for (const chatId of notArchivedChatsIds) {
      const chatsById = global.chats.byId;
      const chat = chatsById[chatId];
      if (chat && chat.id) {
        if (shouldArchive(chat, global)) {
          add(chat.id);
        } else {
          remove(chat.id);
        }
      }
    }
    if (JSON.parse(String(localStorage.getItem('ulu_is_archiver_enabled')))) {
      autoarchive();
    }
  };

  useInterval(() => {
    if (isAutoarchiverMode) {
      processAutoarchiver();
    }
  }, UPDATE_TIME_SEC * 1000);

  const archive24hMessages = () => {
    // eslint-disable-next-line no-console
    console.log('>>> archive24hMessages');
    const global = getGlobal();
    const notArchivedChatsIds = global.chats.listIds.active;
    if (!notArchivedChatsIds) {
      return;
    }
    for (const chatId of notArchivedChatsIds) {
      const chatsById = global.chats.byId;
      const chat = chatsById[chatId];
      if (chat && chat.id) {
        if (
          shouldArchive(chat, global)
          && ((chat.lastMessage?.editDate || chat.lastMessage?.date || 0) < Math.round(Date.now() / 1000) - SEC_24H)
        ) {
          add(chat.id);
        } else {
          remove(chat.id);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log('chatsToArchive', chatsToArchive);

    const timer = setInterval(() => {
      if (Object.keys(chatsToArchive).length < BATCH_SIZE) {
        clearInterval(timer);
        // eslint-disable-next-line no-console
        console.log('archiver: clear timer');
      }
      for (const id of Object.keys(chatsToArchive).slice(0, BATCH_SIZE)) {
        toggleChatArchived({ id });
        remove(id);
      }
    }, UPDATE_TIME_SEC * 1000);
  };

  return { archive24hMessages };
}
