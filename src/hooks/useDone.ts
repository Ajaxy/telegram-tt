import { useCallback, useEffect } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import type { ApiChat } from '../api/types';

import { selectCurrentChat, selectTabState } from '../global/selectors';
import useArchiver from './useArchiver';
import { useStorage } from './useStorage';

const shouldBeDone = (chat: ApiChat) => {
  return chat.isMuted || !(
    chat.hasUnreadMark
    || chat.unreadCount
    || chat.unreadMentionsCount
    || chat.unreadReactionsCount
  );
};

export default function useDone() {
  const { archiveChat, archiveChats } = useArchiver({ isManual: true });
  const {
    openChat, closeForumPanel, showNotification,
  } = getActions();
  const { doneChatIds, setDoneChatIds, isArchiveWhenDoneEnabled } = useStorage();

  const isChatDone = useCallback((chat: ApiChat) => {
    return doneChatIds.includes(chat.id);
  }, [doneChatIds]);

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
      const updDone = !doneChatIds.includes(togglingChatId);
      if (value !== undefined && (updDone !== value)) {
        return;
      }

      const updDoneChatIds = updDone
        ? [...doneChatIds, togglingChatId]
        : doneChatIds.filter((chatId: string) => chatId !== togglingChatId);
      setDoneChatIds(updDoneChatIds);

      let isArchiveAction: boolean = false;
      if (isArchiveWhenDoneEnabled && updDone) {
        isArchiveAction = archiveChat({
          id: togglingChatId,
          value: updDone,
          isClose: false,
          isNotification: false,
        });
      }

      if (isClose) {
        openChat({ id: undefined });
        if (togglingChatId === forumPanelChatId) {
          closeForumPanel();
        }
      }
      if (isNotification) {
        showNotification({
          message: `The chat marked as ${
            updDone ? '"Done"' : '"Not done"'
          }${
            isArchiveAction ? (` and ${updDone ? 'archived' : 'unachived'}`) : ''
          }`,
        });
      }
    }
  }, [archiveChat, doneChatIds, isArchiveWhenDoneEnabled, setDoneChatIds]);

  const doneAllReadChats = useCallback(() => {
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

      if (isArchiveWhenDoneEnabled) {
        archiveChats(chatIdsToBeDone);
      }
    }
  }, [archiveChats, doneChatIds, isArchiveWhenDoneEnabled, isChatDone, setDoneChatIds]);

  return { doneChat, isChatDone, doneAllReadChats };
}

const EVENT_NAME = 'update_chat_done';

export function useDoneUpdates() {
  const {
    doneChatIds, setDoneChatIds, isAutoDoneEnabled, isArchiveWhenDoneEnabled,
  } = useStorage();
  const { archiveChat } = useArchiver({ isManual: true });

  useEffect(() => {
    const listener = (e: any) => {
      const chat = e.detail.chat as ApiChat;
      if (chat && chat.id) {
        if (doneChatIds.includes(chat.id) && !shouldBeDone(chat)) {
          setDoneChatIds(doneChatIds.filter((chatId: string) => chatId !== chat.id));
        }
        if (isAutoDoneEnabled && !doneChatIds.includes(chat.id) && shouldBeDone(chat)) {
          // may be rewritten to `doneChat`
          setDoneChatIds([...doneChatIds, chat.id]);
          if (isArchiveWhenDoneEnabled) {
            setTimeout(() => {
              archiveChat({
                id: chat.id,
                value: true,
                isClose: false,
                isNotification: false,
              });
            }, 200);
          }
        }
      }
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
  }, [doneChatIds, setDoneChatIds, isAutoDoneEnabled, archiveChat, isArchiveWhenDoneEnabled]);
}

export function updateChatDone(chat: ApiChat) {
  window.dispatchEvent(new CustomEvent<{ chat: ApiChat }>(EVENT_NAME, {
    detail: { chat },
  }));
}
