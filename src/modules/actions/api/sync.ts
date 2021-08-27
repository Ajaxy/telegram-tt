import {
  addReducer, getGlobal, setGlobal, getDispatch,
} from '../../../lib/teact/teactn';

import {
  ApiChat, ApiFormattedText, ApiUser, MAIN_THREAD_ID,
} from '../../../api/types';
import { GlobalActions } from '../../../global/types';

import {
  CHAT_LIST_LOAD_SLICE, DEBUG, MESSAGE_LIST_SLICE,
} from '../../../config';
import { callApi } from '../../../api/gramjs';
import { buildCollectionByKey } from '../../../util/iteratees';
import {
  replaceChatListIds,
  replaceChats,
  replaceUsers,
  updateUsers,
  updateChats,
  updateChatListSecondaryInfo,
  updateThreadInfos,
  replaceThreadParam,
} from '../../reducers';
import {
  selectUser, selectChat, selectCurrentMessageList, selectDraft, selectChatMessage, selectThreadInfo,
} from '../../selectors';
import { isChatPrivate } from '../../helpers';

addReducer('sync', (global, actions) => {
  void sync(actions.afterSync);
});

addReducer('afterSync', (global, actions) => {
  void afterSync(actions);
});

async function sync(afterSyncCallback: () => void) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START SYNC');
  }

  await callApi('fetchCurrentUser');

  // This fetches only active chats and clears archived chats, which will be fetched in `afterSync`
  const savedUsers = await loadAndReplaceChats();
  await loadAndReplaceMessages(savedUsers);

  setGlobal({
    ...getGlobal(),
    lastSyncTime: Date.now(),
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> FINISH SYNC');
  }

  afterSyncCallback();
}

async function afterSync(actions: GlobalActions) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START AFTER-SYNC');
  }

  actions.loadFavoriteStickers();

  await Promise.all([
    loadAndUpdateUsers(),
    loadAndReplaceArchivedChats(),
  ]);

  await callApi('fetchCurrentUser');

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> FINISH AFTER-SYNC');
  }
}

async function loadAndReplaceChats() {
  const result = await callApi('fetchChats', {
    limit: CHAT_LIST_LOAD_SLICE,
    withPinned: true,
    serverTimeOffset: getGlobal().serverTimeOffset,
  });
  if (!result) {
    return undefined;
  }

  let global = getGlobal();

  const { recentlyFoundChatIds } = global.globalSearch;
  const { userIds: contactIds } = global.contactList || {};
  const { currentUserId } = global;

  const savedPrivateChatIds = [
    ...(recentlyFoundChatIds || []),
    ...(contactIds || []),
    ...(currentUserId ? [currentUserId] : []),
  ];

  const savedUsers = savedPrivateChatIds
    .map((id) => selectUser(global, id))
    .filter<ApiUser>(Boolean as any);

  const savedChats = savedPrivateChatIds
    .map((id) => selectChat(global, id))
    .filter<ApiChat>(Boolean as any);

  const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
  if (currentChatId) {
    const selectedChat = selectChat(global, currentChatId);
    if (selectedChat && !savedPrivateChatIds.includes(currentChatId)) {
      savedChats.push(selectedChat);
    }

    if (isChatPrivate(currentChatId)) {
      const selectedChatUser = selectUser(global, currentChatId);
      if (selectedChatUser && !savedPrivateChatIds.includes(currentChatId)) {
        savedUsers.push(selectedChatUser);
      }
    }
  }

  savedUsers.push(...result.users);
  savedChats.push(...result.chats);

  global = replaceChats(global, buildCollectionByKey(savedChats, 'id'));
  global = replaceChatListIds(global, 'active', result.chatIds);

  global = {
    ...global,
    chats: {
      ...global.chats,
    },
  };

  global = updateChatListSecondaryInfo(global, 'active', result);

  Object.keys(result.draftsById).map(Number).forEach((chatId) => {
    global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'draft', result.draftsById[chatId]);
  });

  Object.keys(result.replyingToById).map(Number).forEach((chatId) => {
    global = replaceThreadParam(
      global, chatId, MAIN_THREAD_ID, 'replyingToId', result.replyingToById[chatId],
    );
  });

  setGlobal(global);

  if (currentChatId && !global.chats.byId[currentChatId]) {
    getDispatch().openChat({ id: undefined });
  }

  return savedUsers;
}

async function loadAndReplaceArchivedChats() {
  const result = await callApi('fetchChats', {
    limit: CHAT_LIST_LOAD_SLICE,
    archived: true,
    withPinned: true,
    serverTimeOffset: getGlobal().serverTimeOffset,
  });

  if (!result) {
    return;
  }

  let global = getGlobal();
  global = updateUsers(global, buildCollectionByKey(result.users, 'id'));
  global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
  global = replaceChatListIds(global, 'archived', result.chatIds);
  global = updateChatListSecondaryInfo(global, 'archived', result);
  setGlobal(global);
}

async function loadAndReplaceMessages(savedUsers?: ApiUser[]) {
  let areMessagesLoaded = false;
  let users = savedUsers || [];

  let global = getGlobal();
  const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};

  // Memoize drafts
  const draftChatIds = Object.keys(global.messages.byChatId).map(Number);
  const draftsByChatId = draftChatIds.reduce<Record<number, ApiFormattedText>>((acc, chatId) => {
    const draft = selectDraft(global, chatId, MAIN_THREAD_ID);
    return draft ? { ...acc, [chatId]: draft } : acc;
  }, {});

  if (currentChatId) {
    const result = await loadTopMessages(global.chats.byId[currentChatId]);
    global = getGlobal();
    const { chatId: newCurrentChatId } = selectCurrentMessageList(global) || {};
    const threadInfo = currentThreadId && selectThreadInfo(global, currentChatId, currentThreadId);

    if (result && newCurrentChatId === currentChatId) {
      const currentMessageListInfo = global.messages.byChatId[currentChatId];
      const byId = buildCollectionByKey(result.messages, 'id');
      const listedIds = Object.keys(byId).map(Number);

      global = {
        ...global,
        messages: {
          ...global.messages,
          byChatId: {
            [currentChatId]: {
              byId,
              threadsById: {
                [MAIN_THREAD_ID]: {
                  ...(currentMessageListInfo?.threadsById[MAIN_THREAD_ID]),
                  listedIds,
                  viewportIds: listedIds,
                  outlyingIds: undefined,
                },
              },
            },
          },
        },
      };

      if (currentThreadId && threadInfo && threadInfo.originChannelId) {
        const { originChannelId } = threadInfo;
        const currentMessageListInfoOrigin = global.messages.byChatId[originChannelId];
        const resultOrigin = await loadTopMessages(global.chats.byId[originChannelId]);
        if (resultOrigin) {
          const byIdOrigin = buildCollectionByKey(resultOrigin.messages, 'id');
          const listedIdsOrigin = Object.keys(byIdOrigin)
            .map(Number);

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
      global = updateThreadInfos(global, currentChatId, result.threadInfos);

      areMessagesLoaded = true;
      users = Array.prototype.concat(users, result.users);
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
  Object.keys(draftsByChatId).map(Number).forEach((chatId) => {
    global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'draft', draftsByChatId[chatId]);
  });

  if (savedUsers) {
    global = replaceUsers(global, buildCollectionByKey(users, 'id'));
  } else if (users) {
    // If `fetchChats` has failed for some reason, we don't have saved chats, thus we can not replace
    global = updateUsers(global, buildCollectionByKey(users, 'id'));
  }

  setGlobal(global);

  const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
  if (audioChatId && audioMessageId && !selectChatMessage(global, audioChatId, audioMessageId)) {
    getDispatch().closeAudioPlayer();
  }
}

async function loadAndUpdateUsers() {
  let global = getGlobal();
  const { recentlyFoundChatIds } = global.globalSearch;
  const { userIds: contactIds } = global.contactList || {};
  if (
    (!contactIds || !contactIds.length)
    && (!recentlyFoundChatIds || !recentlyFoundChatIds.length)
  ) {
    return;
  }

  const users = [
    ...(recentlyFoundChatIds || []),
    ...(contactIds || []),
  ].map((id) => selectUser(global, id)).filter<ApiUser>(Boolean as any);

  const updatedUsers = await callApi('fetchUsers', { users });
  if (!updatedUsers) {
    return;
  }

  global = getGlobal();
  global = updateUsers(global, buildCollectionByKey(updatedUsers, 'id'));
  setGlobal(global);
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
