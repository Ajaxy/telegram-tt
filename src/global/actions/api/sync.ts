import {
  addActionHandler, getGlobal, setGlobal, getActions,
} from '../../index';

import {
  ApiChat, ApiFormattedText, ApiMessage, MAIN_THREAD_ID,
} from '../../../api/types';

import {
  DEBUG, MESSAGE_LIST_SLICE, SERVICE_NOTIFICATIONS_USER_ID,
} from '../../../config';
import { callApi } from '../../../api/gramjs';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  updateUsers,
  updateChats,
  updateThreadInfos,
  replaceThreadParam,
  updateListedIds,
  safeReplaceViewportIds,
  addChatMessagesById,
} from '../../reducers';
import {
  selectCurrentMessageList,
  selectDraft,
  selectChatMessage,
  selectThreadInfo,
} from '../../selectors';
import { init as initFolderManager } from '../../../util/folderManager';

const RELEASE_STATUS_TIMEOUT = 15000; // 10 sec;

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

  // Memoize drafts
  const draftChatIds = Object.keys(global.messages.byChatId);
  const draftsByChatId = draftChatIds.reduce<Record<string, ApiFormattedText>>((acc, chatId) => {
    const draft = selectDraft(global, chatId, MAIN_THREAD_ID);
    if (draft) {
      acc[chatId] = draft;
    }

    return acc;
  }, {});

  const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};
  const currentChat = currentChatId ? global.chats.byId[currentChatId] : undefined;
  if (currentChatId && currentChat) {
    const result = await loadTopMessages(currentChat);
    global = getGlobal();
    const { chatId: newCurrentChatId } = selectCurrentMessageList(global) || {};
    const threadInfo = currentThreadId && selectThreadInfo(global, currentChatId, currentThreadId);

    if (result && newCurrentChatId === currentChatId) {
      const currentMessageListInfo = global.messages.byChatId[currentChatId];
      const localMessages = currentChatId === SERVICE_NOTIFICATIONS_USER_ID
        ? global.serviceNotifications.map(({ message }) => message)
        : [];
      const allMessages = ([] as ApiMessage[]).concat(result.messages, localMessages);
      const byId = buildCollectionByKey(allMessages, 'id');
      const listedIds = Object.keys(byId).map(Number);

      global = {
        ...global,
        messages: {
          ...global.messages,
          byChatId: {},
        },
      };

      global = addChatMessagesById(global, currentChatId, byId);
      global = updateListedIds(global, currentChatId, MAIN_THREAD_ID, listedIds);
      global = safeReplaceViewportIds(global, currentChatId, MAIN_THREAD_ID, listedIds);

      if (currentThreadId && threadInfo && threadInfo.originChannelId) {
        const { originChannelId } = threadInfo;
        const currentMessageListInfoOrigin = global.messages.byChatId[originChannelId];
        const resultOrigin = await loadTopMessages(global.chats.byId[originChannelId]);
        if (resultOrigin) {
          const byIdOrigin = buildCollectionByKey(resultOrigin.messages, 'id');
          const listedIdsOrigin = Object.keys(byIdOrigin).map(Number);

          global = {
            ...global,
            messages: {
              ...global.messages,
              byChatId: {
                ...global.messages.byChatId,
                [threadInfo.originChannelId]: {
                  byId: byIdOrigin,
                  threadsById: {
                    [MAIN_THREAD_ID]: {
                      ...(currentMessageListInfoOrigin?.threadsById[MAIN_THREAD_ID]),
                      listedIds: listedIdsOrigin,
                      viewportIds: listedIdsOrigin,
                      outlyingIds: undefined,
                    },
                  },
                },
                [currentChatId]: {
                  ...global.messages.byChatId[currentChatId],
                  threadsById: {
                    ...global.messages.byChatId[currentChatId].threadsById,
                    [currentThreadId]: {
                      ...(currentMessageListInfo?.threadsById[currentThreadId]),
                      outlyingIds: undefined,
                    },
                  },
                },
              },
            },
          };
        }
      }

      global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
      global = updateUsers(global, buildCollectionByKey(result.users, 'id'));
      global = updateThreadInfos(global, currentChatId, result.threadInfos);

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
    global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'draft', draftsByChatId[chatId]);
  });

  setGlobal(global);

  const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
  if (audioChatId && audioMessageId && !selectChatMessage(global, audioChatId, audioMessageId)) {
    getActions().closeAudioPlayer();
  }
}

function loadTopMessages(chat: ApiChat) {
  return callApi('fetchMessages', {
    chat,
    threadId: MAIN_THREAD_ID,
    offsetId: chat.lastReadInboxMessageId,
    addOffset: -(Math.round(MESSAGE_LIST_SLICE / 2) + 1),
    limit: MESSAGE_LIST_SLICE,
  });
}
