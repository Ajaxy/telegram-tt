import { useCallback, useEffect } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import type { ApiChat } from '../api/types';

import { selectCurrentChat, selectTabState } from '../global/selectors';
import { useJune } from './useJune';
import { useStorage } from './useStorage';
// import useArchiver from './useArchiver';

const EVENT_NAME = 'update_chat_done';

const shouldBeDone = (chat: ApiChat) => {
  return chat.isMuted || !(
    chat.hasUnreadMark
    || chat.unreadCount
    || chat.unreadMentionsCount
    || chat.unreadReactionsCount
  );
};

export default function useDone() {
  // const { archiveChat } = useArchiver({ isManual: true });
  const {
    openChat, closeForumPanel, showNotification,
  } = getActions();
  const { track } = useJune();
  const { doneChatIds, setDoneChatIds } = useStorage();

  const isChatDone = (chat: ApiChat) => {
    return doneChatIds.includes(chat.id);
  };

  const doneChat = useCallback(({
    id, value, isClose = true, isNotification = true,
  }: {
    id?: string;
    value?: boolean;
    isClose?: boolean;
    isNotification?: boolean;
  }) => {
    const global = getGlobal();
    const currentChatId = selectCurrentChat(global)?.id;
    const forumPanelChatId = selectTabState(global).forumPanelChatId;
    const openedChatId = currentChatId || forumPanelChatId;
    const togglingChatId = id || openedChatId;

    if (togglingChatId) {
      const isDone = doneChatIds.includes(togglingChatId);
      if (value !== undefined && (isDone === value)) {
        return;
      }

      const updDoneChatIds = !isDone
        ? [...doneChatIds, togglingChatId]
        : doneChatIds.filter((chatId: string) => chatId !== togglingChatId);
      setDoneChatIds(updDoneChatIds);

      /*
        archiveChat({ id, value });
      */

      if (isClose) {
        openChat({ id: undefined });
        if (togglingChatId === forumPanelChatId) {
          closeForumPanel();
        }
      }
      if (isNotification) {
        showNotification({
          message: `The chat marked as ${isDone ? '"Not done"' : '"Done"'}`,
        });
      }
      track?.(isDone ? 'toggleChatUndone' : 'toggleChatDone');
    }
  }, [doneChatIds, setDoneChatIds, track]);

  const doneAllReadChats = () => {
    const global = getGlobal();
    const allChatsIds = [
      ...(global.chats.listIds.active || []),
      ...(global.chats.listIds.archived || []),
    ];
    const chatIdsToBeDone = [];
    for (const chatId of allChatsIds) {
      const chatsById = global.chats.byId;
      const chat = chatsById[chatId];
      if (chat && chat.id && !isChatDone(chat) && shouldBeDone(chat)) {
        chatIdsToBeDone.push(chat.id);
      }
    }
    if (chatIdsToBeDone.length) {
      setDoneChatIds([...doneChatIds, ...chatIdsToBeDone]);
    }
  };

  return { doneChat, isChatDone, doneAllReadChats };
}

export function useUpdateChatDone() {
  const { doneChatIds, setDoneChatIds } = useStorage();

  useEffect(() => {
    const listener = (e: any) => {
      const chat = e.detail.chat as ApiChat;
      if (chat && chat.id && doneChatIds.includes(chat.id) && !shouldBeDone(chat)) {
        setDoneChatIds(doneChatIds.filter((chatId: string) => chatId !== chat.id));
      }
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
  }, [doneChatIds, setDoneChatIds]);
}

export function updateChatDone(chat: ApiChat) {
  window.dispatchEvent(new CustomEvent<{ chat: ApiChat }>(EVENT_NAME, {
    detail: { chat },
  }));
}
