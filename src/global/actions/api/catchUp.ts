import type { ActionReturnType } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { callApi } from '../../../api/gramjs';
import { accumulateCatchUp, createCatchUpAccumulator, finalizeCatchUp } from '../../helpers/catchUp';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat, selectChatMessages, selectRealLastReadId, selectTabState,
} from '../../selectors';

const BATCH_SIZE = 100;
const MAX_SCANNED_MESSAGES = 1000;

addActionHandler('openCatchUpModal', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;

  global = updateTabState(global, {
    catchUpModal: { chatId, isLoading: true },
  }, tabId);
  setGlobal(global);

  actions.loadCatchUp({ chatId, tabId });
});

addActionHandler('closeCatchUpModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, { catchUpModal: undefined }, tabId);
});

addActionHandler('loadCatchUp', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  const lastReadId = selectRealLastReadId(global, chatId, MAIN_THREAD_ID) || 0;
  if (!chat) return;

  const ownMessageIds = Object.values(selectChatMessages(global, chatId) || {})
    .filter((message) => message.isOutgoing)
    .map((message) => message.id);
  const accumulator = createCatchUpAccumulator(chatId, global.currentUserId, ownMessageIds);

  let offsetId: number | undefined;
  let scannedCount = 0;
  let isComplete = false;

  while (scannedCount < MAX_SCANNED_MESSAGES) {
    const result = await callApi('fetchMessages', {
      chat,
      threadId: MAIN_THREAD_ID,
      offsetId,
      addOffset: 0,
      limit: BATCH_SIZE,
    });
    if (!result) break;

    const batch = result.messages
      .filter((message) => !offsetId || message.id < offsetId)
      .sort((a, b) => b.id - a.id);
    if (!batch.length) {
      isComplete = true;
      break;
    }

    const unread = batch.filter((message) => message.id > lastReadId);
    accumulateCatchUp(accumulator, unread);
    scannedCount += unread.length;

    if (unread.length < batch.length || batch.length < BATCH_SIZE) {
      isComplete = true;
      break;
    }
    offsetId = batch[batch.length - 1].id;
  }

  global = getGlobal();
  const modal = selectTabState(global, tabId).catchUpModal;
  if (modal?.chatId !== chatId) return;

  global = updateTabState(global, {
    catchUpModal: { chatId, isLoading: false, summary: finalizeCatchUp(accumulator, isComplete) },
  }, tabId);
  setGlobal(global);
});
