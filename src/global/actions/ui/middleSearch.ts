import type { ActionReturnType } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import {
  closeMiddleSearch,
  resetMiddleSearch,
  updateMiddleSearch,
  updateSharedMediaSearchType,
} from '../../reducers';
import { selectCurrentMessageList } from '../../selectors';

addActionHandler('openMiddleSearch', (global, actions, payload): ActionReturnType => {
  const { fromPeerId, tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return updateMiddleSearch(global, chatId, threadId, { fromPeerId }, tabId);
});

addActionHandler('closeMiddleSearch', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return closeMiddleSearch(global, chatId, threadId, tabId);
});

addActionHandler('updateMiddleSearch', (global, actions, payload): ActionReturnType => {
  const {
    update, tabId = getCurrentTabId(),
  } = payload;

  let chatId;
  let threadId;
  if (payload.chatId) {
    chatId = payload.chatId;
    threadId = payload.threadId || MAIN_THREAD_ID;
  } else {
    const currentMessageList = selectCurrentMessageList(global, tabId);
    if (!currentMessageList) {
      return undefined;
    }
    chatId = currentMessageList.chatId;
    threadId = currentMessageList.threadId;
  }

  global = updateMiddleSearch(global, chatId, threadId, update, tabId);

  return global;
});

addActionHandler('resetMiddleSearch', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return resetMiddleSearch(global, chatId, threadId, tabId);
});

addActionHandler('setSharedMediaSearchType', (global, actions, payload): ActionReturnType => {
  const { mediaType, tabId = getCurrentTabId() } = payload;
  const { chatId, threadId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId || !threadId) {
    return undefined;
  }

  return updateSharedMediaSearchType(global, chatId, threadId, mediaType, tabId);
});
