import { useCallback } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import type { ApiChat } from '../api/types';

import { selectCurrentChat, selectTabState } from '../global/selectors';
import { useJune } from './useJune';
import { useStorage } from './useStorage';
// import useArchiver from './useArchiver';

export default function useDone() {
  // const { archiveChat } = useArchiver({ isManual: true });
  const {
    openChat, closeForumPanel, showNotification,
  } = getActions();
  const { track } = useJune();
  const { doneChatIds, setDoneChatIds } = useStorage();

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
      const doneChat = useCallback(({ id, value }: { id?: string; value?: boolean }) => {
        archiveChat({ id, value });
      }, [archiveChat]);
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

  const isChatDone = (chat: ApiChat) => {
    return doneChatIds.includes(chat.id);
  };

  const doneAllReadChats = () => {
    // todo
  };

  return { doneChat, isChatDone, doneAllReadChats };
}
