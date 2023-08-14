import type { RequiredGlobalActions } from '../../index';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import { addCallback } from '../../../lib/teact/teactn';

import type { ApiChat, ApiMessage } from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import type { ActionReturnType, GlobalState, Thread } from '../../types';

import { DEBUG, MESSAGE_LIST_SLICE, SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { callApi } from '../../../api/gramjs';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  addChatMessagesById,
  safeReplaceViewportIds,
  updateChats,
  updateListedIds,
  updateThread, updateThreadInfo,
  updateThreadInfos,
  updateUsers,
} from '../../reducers';
import {
  selectChatMessage,
  selectChatMessages,
  selectCurrentMessageList,
  selectDraft,
  selectEditingDraft,
  selectEditingId, selectReplyingToId,
  selectTabState,
  selectThreadInfo,
} from '../../selectors';
import { init as initFolderManager } from '../../../util/folderManager';
import { updateTabState } from '../../reducers/tabs';

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

  const {
    loadAllChats, preloadTopChatMessages, loadAllStories, loadAllHiddenStories,
  } = actions;

  loadAllChats({
    listType: 'active',
    shouldReplace: true,
    onReplace: async () => {
      await loadAndReplaceMessages(global, actions);

      global = getGlobal();
      global = {
        ...global,
        isSyncing: false,
        isSynced: true,
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
      loadAllStories();
      loadAllHiddenStories();
    },
  });
});

async function loadAndReplaceMessages<T extends GlobalState>(global: T, actions: RequiredGlobalActions) {
  let areMessagesLoaded = false;

  global = getGlobal();

  let wasReset = false;

  // Memoize drafts
  const draftChatIds = Object.keys(global.messages.byChatId);
  /* eslint-disable @typescript-eslint/indent */
  const draftsByChatId = draftChatIds.reduce<Record<string, Record<number, Partial<Thread>>>>((acc, chatId) => {
    acc[chatId] = Object
      .keys(global.messages.byChatId[chatId].threadsById)
      .reduce<Record<number, Partial<Thread>>>((acc2, threadId) => {
        acc2[Number(threadId)] = {
          draft: selectDraft(global, chatId, Number(threadId)),
          editingId: selectEditingId(global, chatId, Number(threadId)),
          editingDraft: selectEditingDraft(global, chatId, Number(threadId)),
          replyingToId: selectReplyingToId(global, chatId, Number(threadId)),
        };

        return acc2;
      }, {});
    return acc;
  }, {});
  /* eslint-enable @typescript-eslint/indent */

  for (const { id: tabId } of Object.values(global.byTabId)) {
    global = getGlobal();
    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global, tabId) || {};
    const activeThreadId = currentThreadId || MAIN_THREAD_ID;
    const threadInfo = currentThreadId && currentChatId
      ? selectThreadInfo(global, currentChatId, currentThreadId) : undefined;
    const currentChat = currentChatId ? global.chats.byId[currentChatId] : undefined;
    if (currentChatId && currentChat) {
      const result = await loadTopMessages(currentChat, activeThreadId, threadInfo?.lastReadInboxMessageId);
      global = getGlobal();
      const { chatId: newCurrentChatId } = selectCurrentMessageList(global, tabId) || {};

      if (result && newCurrentChatId === currentChatId) {
        const currentChatMessages = selectChatMessages(global, currentChatId);
        const localMessages = currentChatId === SERVICE_NOTIFICATIONS_USER_ID
          ? global.serviceNotifications.filter(({ isDeleted }) => !isDeleted).map(({ message }) => message)
          : [];
        const topicLastMessages = currentChat.isForum && currentChat.topics
          ? Object.values(currentChat.topics)
            .map(({ lastMessageId }) => currentChatMessages[lastMessageId])
            .filter(Boolean)
          : [];

        const allMessages = ([] as ApiMessage[]).concat(result.messages, localMessages);
        const allMessagesWithTopicLastMessages = allMessages.concat(topicLastMessages);
        const byId = buildCollectionByKey(allMessagesWithTopicLastMessages, 'id');
        const listedIds = allMessages.map(({ id }) => id);

        if (!wasReset) {
          global = {
            ...global,
            messages: {
              ...global.messages,
              byChatId: {},
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
            global = updateTabState(global, {
              tabThreads: {},
            }, otherTabId);
          });
          wasReset = true;
        }

        global = addChatMessagesById(global, currentChatId, byId);
        global = updateListedIds(global, currentChatId, activeThreadId, listedIds);
        if (threadInfo?.originChannelId) {
          global = updateThreadInfo(global, currentChatId, activeThreadId, threadInfo);
        }
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
          const { chatId: otherChatId, threadId: otherThreadId } = selectCurrentMessageList(global, otherTabId) || {};
          if (otherChatId === currentChatId && otherThreadId === activeThreadId) {
            global = safeReplaceViewportIds(global, currentChatId, activeThreadId, listedIds, otherTabId);
          }
        });
        global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
        global = updateUsers(global, buildCollectionByKey(result.users, 'id'));
        if (result.repliesThreadInfos.length) {
          global = updateThreadInfos(global, result.repliesThreadInfos);
        }

        areMessagesLoaded = true;
      }
    }

    setGlobal(global);

    if (currentChat?.isForum) {
      actions.loadTopics({ chatId: currentChatId!, force: true });
      if (currentThreadId && currentThreadId !== MAIN_THREAD_ID) {
        actions.loadTopicById({
          chatId: currentChatId!, topicId: currentThreadId, shouldCloseChatOnError: true,
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
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
      global = updateTabState(global, {
        tabThreads: {},
      }, otherTabId);
    });
  }

  // Restore drafts
  // eslint-disable-next-line @typescript-eslint/no-loop-func
  Object.keys(draftsByChatId).forEach((chatId) => {
    const threads = draftsByChatId[chatId];
    Object.keys(threads).forEach((threadId) => {
      global = updateThread(global, chatId, Number(threadId), draftsByChatId[chatId][Number(threadId)]);
    });
  });

  setGlobal(global);

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
  const { connectionState, authState, isSynced } = global;
  const { isMasterTab } = selectTabState(global);
  if (!isMasterTab || isSynced || (previousGlobal?.connectionState === connectionState
    && previousGlobal?.authState === authState)) {
    previousGlobal = global;
    return;
  }

  if (connectionState === 'connectionStateReady' && authState === 'authorizationStateReady') {
    // eslint-disable-next-line eslint-multitab-tt/no-getactions-in-actions
    getActions().sync();
  }

  previousGlobal = global;
});
