import type { ActionReturnType } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { callApi } from '../../../api/gramjs';
import {
  accumulateChatInsights,
  createChatInsightsAccumulator,
  finalizeChatInsights,
} from '../../helpers/chatInsights';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectChat, selectTabState } from '../../selectors';

const BATCH_SIZE = 100;
const MAX_SCANNED_MESSAGES = 5000;

addActionHandler('openChatInsightsModal', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;

  global = updateTabState(global, {
    chatInsightsModal: { chatId, scannedCount: 0, isLoading: true },
  }, tabId);
  setGlobal(global);

  actions.loadChatInsights({ chatId, tabId });
});

addActionHandler('closeChatInsightsModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, { chatInsightsModal: undefined }, tabId);
});

addActionHandler('loadChatInsights', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const accumulator = createChatInsightsAccumulator(chatId, global.currentUserId);
  let offsetId: number | undefined;
  let scannedCount = 0;
  let totalCount: number | undefined;
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

    const messages = result.messages
      .filter((message) => !offsetId || message.id < offsetId)
      .sort((a, b) => b.id - a.id);
    if (!messages.length) {
      isComplete = true;
      break;
    }

    accumulateChatInsights(accumulator, messages);
    scannedCount += messages.length;
    totalCount = result.count ?? totalCount;
    offsetId = messages[messages.length - 1].id;

    global = getGlobal();
    const modal = selectTabState(global, tabId).chatInsightsModal;
    if (modal?.chatId !== chatId) return;

    global = updateTabState(global, {
      chatInsightsModal: { ...modal, scannedCount, totalCount },
    }, tabId);
    setGlobal(global);

    if (messages.length < BATCH_SIZE) {
      isComplete = true;
      break;
    }
  }

  global = getGlobal();
  const modal = selectTabState(global, tabId).chatInsightsModal;
  if (modal?.chatId !== chatId) return;

  global = updateTabState(global, {
    chatInsightsModal: {
      ...modal,
      scannedCount,
      totalCount,
      isLoading: false,
      insights: finalizeChatInsights(accumulator, isComplete),
    },
  }, tabId);
  setGlobal(global);
});
