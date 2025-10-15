import { addCallback } from '../../../lib/teact/teactn';

import type { ApiThreadInfo } from '../../../api/types/messages';
import type { Thread, ThreadId } from '../../../types';
import type { RequiredGlobalActions } from '../../index';
import type { ActionReturnType, GlobalState } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { DEBUG, MESSAGE_LIST_SLICE, SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { init as initFolderManager } from '../../../util/folderManager';
import {
  buildCollectionByKey, omitUndefined, pick, unique,
} from '../../../util/iteratees';
import { callApi } from '../../../api/gramjs';
import { getIsSavedDialog } from '../../helpers';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import {
  addChatMessagesById,
  addMessages,
  safeReplaceViewportIds,
  updateChats,
  updateListedIds,
  updateThread,
  updateThreadInfo,
  updateUsers,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectCurrentMessageList,
  selectDraft,
  selectEditingDraft,
  selectEditingId,
  selectTabState,
  selectThreadInfo,
  selectTopics,
} from '../../selectors';

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
    loadAllChats, preloadTopChatMessages,
  } = actions;

  initFolderManager();

  loadAllChats({
    listType: 'active',
    whenFirstBatchDone: async () => {
      await loadAndReplaceMessages(global, actions);

      global = getGlobal();
      global = {
        ...global,
        isSyncing: false,
        isSynced: true,
        isFetchingDifference: false,
      };
      setGlobal(global);

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('>>> FINISH SYNC');
      }

      loadAllChats({ listType: 'archived' });
      preloadTopChatMessages();
    },
  });
});

async function loadAndReplaceMessages<T extends GlobalState>(global: T, actions: RequiredGlobalActions) {
  let areMessagesLoaded = false;

  global = getGlobal();

  let wasReset = false;

  // Memoize drafts
  const draftChatIds = Object.keys(global.messages.byChatId);
  const draftsByChatId = draftChatIds.reduce<Record<string, Record<number, Partial<Thread>>>>((acc, chatId) => {
    acc[chatId] = Object
      .keys(global.messages.byChatId[chatId].threadsById)
      .reduce<Record<number, Partial<Thread>>>((acc2, threadId) => {
        acc2[Number(threadId)] = omitUndefined({
          draft: selectDraft(global, chatId, Number(threadId)),
          editingId: selectEditingId(global, chatId, Number(threadId)),
          editingDraft: selectEditingDraft(global, chatId, Number(threadId)),
        });

        return acc2;
      }, {});
    return acc;
  }, {});

  // Memoize last messages
  const lastMessages = Object.entries(global.chats.lastMessageIds.all || {}).map(([chatId, messageId]) => (
    selectChatMessage(global, chatId, Number(messageId))
  )).filter(Boolean);
  const savedLastMessages = Object.values(global.chats.lastMessageIds.saved || {}).map((messageId) => (
    selectChatMessage(global, global.currentUserId!, Number(messageId))
  )).filter(Boolean);

  // Memoize thread infos for last messages
  const lastMessagesThreadInfos: { chatId: string; messageId: number; threadInfo: ApiThreadInfo }[] = [];
  lastMessages.forEach((message) => {
    const threadInfo = selectThreadInfo(global, message.chatId, message.id);
    if (threadInfo) {
      lastMessagesThreadInfos.push({
        chatId: message.chatId,
        messageId: message.id,
        threadInfo,
      });
    }
  });

  for (const { id: tabId } of Object.values(global.byTabId)) {
    global = getGlobal();
    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global, tabId) || {};
    const activeThreadId = currentThreadId || MAIN_THREAD_ID;
    const threadInfo = currentChatId && currentThreadId
      ? selectThreadInfo(global, currentChatId, currentThreadId) : undefined;
    const currentChat = currentChatId ? global.chats.byId[currentChatId] : undefined;
    if (currentChatId && currentChat) {
      const [result, resultDiscussion] = await Promise.all([
        loadTopMessages(
          global,
          currentChatId,
          activeThreadId,
        ),
        activeThreadId !== MAIN_THREAD_ID && !getIsSavedDialog(currentChat.id, activeThreadId, global.currentUserId)
          ? callApi('fetchDiscussionMessage', {
            chat: currentChat,
            messageId: Number(activeThreadId),
          }) : undefined,
      ]);
      global = getGlobal();
      const { chatId: newCurrentChatId } = selectCurrentMessageList(global, tabId) || {};

      if (result && newCurrentChatId === currentChatId) {
        const currentChatMessages = selectChatMessages(global, currentChatId);
        const localMessages = currentChatId === SERVICE_NOTIFICATIONS_USER_ID
          ? global.serviceNotifications.filter(({ isDeleted }) => !isDeleted).map(({ message }) => message)
          : [];
        const topics = selectTopics(global, currentChatId);
        const topicLastMessages = topics ? Object.values(topics)
          .map(({ lastMessageId }) => currentChatMessages[lastMessageId])
          .filter(Boolean)
          : [];

        const resultMessageIds = result.messages.map(({ id }) => id);
        const messagesThreadInfos = pick(global.messages.byChatId[currentChatId].threadsById, resultMessageIds);

        const isDiscussionStartLoaded = !result.messages.length
          || result.messages.some(({ id }) => id === resultDiscussion?.firstMessageId);
        const threadStartMessages = (isDiscussionStartLoaded && resultDiscussion?.topMessages) || [];
        const allMessages = threadStartMessages.concat(result.messages, localMessages);
        const allMessagesWithTopicLastMessages = allMessages.concat(topicLastMessages);
        const byId = buildCollectionByKey(allMessagesWithTopicLastMessages, 'id');
        const listedIds = unique(allMessages.map(({ id }) => id));

        if (!wasReset) {
          global = {
            ...global,
            messages: {
              ...global.messages,
              byChatId: {},
            },
          };

          Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
            global = updateTabState(global, {
              tabThreads: {},
            }, otherTabId);
          });
          wasReset = true;
        }

        global = addChatMessagesById(global, currentChatId, byId);
        global = updateListedIds(global, currentChatId, activeThreadId, listedIds);

        Object.entries(messagesThreadInfos).forEach(([id, thread]) => {
          if (!thread?.threadInfo) return;
          global = updateThreadInfo(global, currentChatId, id, thread.threadInfo);
        });

        if (threadInfo && !threadInfo.isCommentsInfo && activeThreadId !== MAIN_THREAD_ID) {
          global = updateThreadInfo(global, currentChatId, activeThreadId, {
            ...pick(threadInfo, ['fromChannelId', 'fromMessageId']),
          });
        }

        Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
          const { chatId: otherChatId, threadId: otherThreadId } = selectCurrentMessageList(global, otherTabId) || {};
          if (otherChatId === currentChatId && otherThreadId === activeThreadId) {
            global = safeReplaceViewportIds(global, currentChatId, activeThreadId, listedIds, otherTabId);
          }
        });
        global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
        global = updateUsers(global, buildCollectionByKey(result.users, 'id'));

        areMessagesLoaded = true;
      }
    }

    setGlobal(global);

    if (currentChat?.isForum) {
      actions.loadTopics({ chatId: currentChatId!, force: true });
      if (currentThreadId && currentThreadId !== MAIN_THREAD_ID) {
        actions.loadTopicById({
          chatId: currentChatId!, topicId: Number(currentThreadId), shouldCloseChatOnError: true,
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

    Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
      global = updateTabState(global, {
        tabThreads: {},
      }, otherTabId);
    });
  }

  // Restore drafts

  Object.keys(draftsByChatId).forEach((chatId) => {
    const threads = draftsByChatId[chatId];
    Object.keys(threads).forEach((threadId) => {
      global = updateThread(global, chatId, Number(threadId), draftsByChatId[chatId][Number(threadId)]);
    });
  });

  // Restore thread infos
  lastMessagesThreadInfos.forEach(({ chatId, messageId, threadInfo }) => {
    const memoThreadInfo = selectThreadInfo(global, chatId, messageId);
    if (!memoThreadInfo) {
      global = updateThreadInfo(global, chatId, String(messageId), threadInfo);
    }
  });

  // Restore last messages
  global = addMessages(global, lastMessages);
  global = addMessages(global, savedLastMessages);

  setGlobal(global);

  Object.values(global.byTabId).forEach(({ id: tabId }) => {
    const { chatId: audioChatId, messageId: audioMessageId } = selectTabState(global, tabId).audioPlayer;
    if (audioChatId && audioMessageId && !selectChatMessage(global, audioChatId, audioMessageId)) {
      actions.closeAudioPlayer({ tabId });
    }
  });
}

function loadTopMessages<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  const currentUserId = global.currentUserId!;
  const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);
  const realChatId = isSavedDialog ? String(threadId) : chatId;

  const chat = selectChat(global, realChatId)!;

  return callApi('fetchMessages', {
    chat,
    threadId,
    offsetId: !isSavedDialog ? chat.lastReadInboxMessageId : undefined,
    addOffset: -(Math.round(MESSAGE_LIST_SLICE / 2) + 1),
    limit: MESSAGE_LIST_SLICE,
    isSavedDialog,
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
    getActions().sync();
  }

  previousGlobal = global;
});
