import type { RequiredGlobalActions } from '../../index';
import {
  addActionHandler, getGlobal, setGlobal, getActions,
} from '../../index';
import { addCallback } from '../../../lib/teact/teactn';

import type { ApiChat, ApiMessage } from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import type {
  ActionReturnType, GlobalState, Thread,
} from '../../types';

import {
  DEBUG, MESSAGE_LIST_SLICE, SERVICE_NOTIFICATIONS_USER_ID,
} from '../../../config';
import { callApi } from '../../../api/gramjs';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  updateUsers,
  updateChats,
  updateThreadInfos,
  updateListedIds,
  safeReplaceViewportIds,
  addChatMessagesById,
  updateThread,
} from '../../reducers';
import {
  selectCurrentMessageList,
  selectDraft,
  selectChatMessage,
  selectThreadInfo,
  selectEditingId,
  selectEditingDraft,
  selectChatMessages,
  selectTabState,
} from '../../selectors';
import { init as initFolderManager } from '../../../util/folderManager';

const RELEASE_STATUS_TIMEOUT = 15000; // 15 sec;

let releaseStatusTimeout: number | undefined;

addActionHandler('sync', (global, actions): ActionReturnType => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START SYNC');
  }

  if (releaseStatusTimeout) {
    clearTimeout(releaseStatusTimeout);
  }

  global = getGlobal();
  global = { ...global, isSyncing: true };
  setGlobal(global);

  // Workaround for `isSyncing = true` sometimes getting stuck for some reason
  releaseStatusTimeout = window.setTimeout(() => {
    global = getGlobal();
    global = { ...global, isSyncing: false };
    setGlobal(global);
    releaseStatusTimeout = undefined;
  }, RELEASE_STATUS_TIMEOUT);

  const { loadAllChats, preloadTopChatMessages } = actions;

  loadAllChats({
    listType: 'active',
    shouldReplace: true,
    onReplace: async () => {
      await loadAndReplaceMessages(global, actions);

      global = getGlobal();
      global = {
        ...global,
        lastSyncTime: Date.now(),
        isSyncing: false,
      };
      setGlobal(global);

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('>>> FINISH SYNC');
      }

      initFolderManager();
      loadAllChats({ listType: 'archived', shouldReplace: true });
      void callApi('fetchCurrentUser');
      preloadTopChatMessages();
    },
  });
});

async function loadAndReplaceMessages<T extends GlobalState>(global: T, actions: RequiredGlobalActions) {
  let areMessagesLoaded = false;

  global = getGlobal();

  for (const { id: tabId } of Object.values(global.byTabId)) {
    global = getGlobal();
    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global, tabId) || {};
    const activeThreadId = currentThreadId || MAIN_THREAD_ID;
    const threadInfo = currentThreadId && currentChatId
      ? selectThreadInfo(global, currentChatId, currentThreadId) : undefined;
    // TODO Fix comments chat id, or refetch chat thread here
    const activeCurrentChatId = threadInfo?.originChannelId || currentChatId;
    // Memoize drafts
    const draftChatIds = Object.keys(global.messages.byChatId);
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    const draftsByChatId = draftChatIds.reduce<Record<string, Partial<Thread>>>((acc, chatId) => {
      acc[chatId] = {};
      acc[chatId].draft = selectDraft(global, chatId, activeThreadId);
      acc[chatId].editingId = selectEditingId(global, chatId, activeThreadId);
      acc[chatId].editingDraft = selectEditingDraft(global, chatId, activeThreadId);

      return acc;
    }, {});

    const currentChat = activeCurrentChatId ? global.chats.byId[activeCurrentChatId] : undefined;
    if (activeCurrentChatId && currentChat) {
      const result = await loadTopMessages(currentChat, activeThreadId, threadInfo?.lastReadInboxMessageId);
      global = getGlobal();
      const { chatId: newCurrentChatId } = selectCurrentMessageList(global, tabId) || {};

      if (result && newCurrentChatId === currentChatId) {
        const currentChatMessages = selectChatMessages(global, activeCurrentChatId);
        const localMessages = currentChatId === SERVICE_NOTIFICATIONS_USER_ID
          ? global.serviceNotifications.filter(({ isDeleted }) => !isDeleted).map(({ message }) => message)
          : [];
        const topicLastMessages = currentChat.isForum && currentChat.topics
          ? Object.values(currentChat.topics)
            .map(({ lastMessageId }) => currentChatMessages[lastMessageId])
            .filter(Boolean)
          : [];

        const allMessages = ([] as ApiMessage[]).concat(result.messages, localMessages, topicLastMessages);
        const byId = buildCollectionByKey(allMessages, 'id');
        const listedIds = Object.keys(byId).map(Number);

        global = addChatMessagesById(global, activeCurrentChatId, byId);
        global = updateListedIds(global, activeCurrentChatId, activeThreadId, listedIds);
        global = safeReplaceViewportIds(global, activeCurrentChatId, activeThreadId, listedIds, tabId);
        global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
        global = updateUsers(global, buildCollectionByKey(result.users, 'id'));
        global = updateThreadInfos(global, activeCurrentChatId, result.repliesThreadInfos);

        areMessagesLoaded = true;
      }
    }

    // Restore drafts
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    Object.keys(draftsByChatId).forEach((chatId) => {
      global = updateThread(global, chatId, activeThreadId, draftsByChatId[chatId]);
    });

    setGlobal(global);

    if (currentChat?.isForum) {
      actions.loadTopics({ chatId: activeCurrentChatId!, force: true });
      if (currentThreadId && currentThreadId !== MAIN_THREAD_ID) {
        actions.loadTopicById({
          chatId: activeCurrentChatId!, topicId: currentThreadId, shouldCloseChatOnError: true,
        });
      }
    }
  }

  global = getGlobal();

  if (!areMessagesLoaded) {
    global = {
      ...global,
      messages: {
        ...global.messages,
        byChatId: {},
      },
    };
  }

  Object.values(global.byTabId).forEach(({ id: tabId }) => {
    const { chatId: audioChatId, messageId: audioMessageId } = selectTabState(global, tabId).audioPlayer;
    if (audioChatId && audioMessageId && !selectChatMessage(global, audioChatId, audioMessageId)) {
      actions.closeAudioPlayer({ tabId });
    }
  });
}

function loadTopMessages(chat: ApiChat, threadId: number, lastReadInboxId?: number) {
  return callApi('fetchMessages', {
    chat,
    threadId,
    offsetId: lastReadInboxId || chat.lastReadInboxMessageId,
    addOffset: -(Math.round(MESSAGE_LIST_SLICE / 2) + 1),
    limit: MESSAGE_LIST_SLICE,
  });
}

let previousGlobal: GlobalState | undefined;
// RAF can be unreliable when device goes into sleep mode, so sync logic is handled outside any component
addCallback((global: GlobalState) => {
  const { connectionState, authState } = global;
  const { isMasterTab } = selectTabState(global);
  if (!isMasterTab || (previousGlobal?.connectionState === connectionState
    && previousGlobal?.authState === authState)) return;

  if (connectionState === 'connectionStateReady' && authState === 'authorizationStateReady') {
    // eslint-disable-next-line eslint-multitab-tt/no-getactions-in-actions
    getActions().sync();
  }

  previousGlobal = global;
});
