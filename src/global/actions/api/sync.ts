import {
  addActionHandler, getGlobal, setGlobal, getActions,
} from '../../index';
import { addCallback } from '../../../lib/teact/teactn';

import type { ApiChat, ApiMessage } from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import type { GlobalState, Thread } from '../../types';

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
} from '../../selectors';
import { init as initFolderManager } from '../../../util/folderManager';

const RELEASE_STATUS_TIMEOUT = 15000; // 15 sec;

let releaseStatusTimeout: number | undefined;

addActionHandler('sync', () => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START SYNC');
  }

  if (releaseStatusTimeout) {
    clearTimeout(releaseStatusTimeout);
  }

  setGlobal({ ...getGlobal(), isSyncing: true });

  // Workaround for `isSyncing = true` sometimes getting stuck for some reason
  releaseStatusTimeout = window.setTimeout(() => {
    setGlobal({ ...getGlobal(), isSyncing: false });
    releaseStatusTimeout = undefined;
  }, RELEASE_STATUS_TIMEOUT);

  const { loadAllChats, preloadTopChatMessages } = getActions();

  loadAllChats({
    listType: 'active',
    shouldReplace: true,
    onReplace: async () => {
      await loadAndReplaceMessages();

      setGlobal({
        ...getGlobal(),
        lastSyncTime: Date.now(),
        isSyncing: false,
      });

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

async function loadAndReplaceMessages() {
  let areMessagesLoaded = false;

  let global = getGlobal();
  const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};
  const activeThreadId = currentThreadId || MAIN_THREAD_ID;
  const threadInfo = currentThreadId && currentChatId
    ? selectThreadInfo(global, currentChatId, currentThreadId) : undefined;
  // TODO Fix comments chat id, or refetch chat thread here
  const activeCurrentChatId = threadInfo?.originChannelId || currentChatId;
  // Memoize drafts
  const draftChatIds = Object.keys(global.messages.byChatId);
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
    const { chatId: newCurrentChatId } = selectCurrentMessageList(global) || {};

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

      global = {
        ...global,
        messages: {
          ...global.messages,
          byChatId: {},
        },
      };

      global = addChatMessagesById(global, activeCurrentChatId, byId);
      global = updateListedIds(global, activeCurrentChatId, activeThreadId, listedIds);
      global = safeReplaceViewportIds(global, activeCurrentChatId, activeThreadId, listedIds);
      global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
      global = updateUsers(global, buildCollectionByKey(result.users, 'id'));
      global = updateThreadInfos(global, activeCurrentChatId, result.repliesThreadInfos);

      areMessagesLoaded = true;
    }
  }

  if (!areMessagesLoaded) {
    global = {
      ...global,
      messages: {
        ...global.messages,
        byChatId: {},
      },
    };
  }

  // Restore drafts
  Object.keys(draftsByChatId).forEach((chatId) => {
    global = updateThread(global, chatId, activeThreadId, draftsByChatId[chatId]);
  });

  setGlobal(global);

  if (currentChat?.isForum) {
    getActions().loadTopics({ chatId: activeCurrentChatId!, force: true });
    if (currentThreadId && currentThreadId !== MAIN_THREAD_ID) {
      getActions().loadTopicById({
        chatId: activeCurrentChatId!, topicId: currentThreadId, shouldCloseChatOnError: true,
      });
    }
  }

  const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
  if (audioChatId && audioMessageId && !selectChatMessage(global, audioChatId, audioMessageId)) {
    getActions().closeAudioPlayer();
  }
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
  if (previousGlobal?.connectionState === connectionState && previousGlobal?.authState === authState) return;
  if (connectionState === 'connectionStateReady' && authState === 'authorizationStateReady') {
    getActions().sync();
  }

  previousGlobal = global;
});
