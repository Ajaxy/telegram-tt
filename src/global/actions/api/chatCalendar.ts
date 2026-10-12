import type { ChatCalendar, ChatCalendarDay } from '../../../types/chatCalendar';
import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { addMessages } from '../../reducers/messages';
import { updateTabState } from '../../reducers/tabs';
import { selectChat, selectTabState } from '../../selectors';

const MAX_PAGES_PER_LOAD = 3;

export function getCalendarDayKey(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

addActionHandler('loadChatCalendar', async (global, actions, payload): Promise<void> => {
  const { chatId, untilDate, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const existing = selectTabState(global, tabId).chatCalendar;
  const current: ChatCalendar = existing?.chatId === chatId ? existing : {
    chatId, isLoading: true, days: {}, maxDayCount: 0,
  };
  if (current.isComplete || (untilDate && current.loadedFromDate && current.loadedFromDate <= untilDate)) return;

  global = updateTabState(global, { chatCalendar: { ...current, isLoading: true } }, tabId);
  setGlobal(global);

  const days = { ...current.days };
  let loadedFromDate = current.loadedFromDate;
  let isComplete = false;

  for (let page = 0; page < MAX_PAGES_PER_LOAD; page++) {
    const offsetDate = loadedFromDate;
    const [allResult, photoResult] = await Promise.all([
      callApi('fetchSearchResultsCalendar', { chat, filter: 'all', offsetDate }),
      callApi('fetchSearchResultsCalendar', { chat, filter: 'photos', offsetDate }),
    ]);
    if (!allResult) break;

    allResult.periods.forEach((period) => {
      const key = getCalendarDayKey(period.date);
      const day: ChatCalendarDay = { ...days[key], count: period.count, minMsgId: period.minMsgId };
      days[key] = day;
    });

    if (photoResult) {
      global = getGlobal();
      global = addMessages(global, photoResult.messages);
      setGlobal(global);

      photoResult.periods.forEach((period) => {
        const key = getCalendarDayKey(period.date);
        const message = photoResult.messages.find((m) => m.id === period.minMsgId);
        if (!days[key]) days[key] = { count: period.count, minMsgId: period.minMsgId };
        days[key].mediaMessageId = message?.id || period.minMsgId;
      });
    }

    const pageMinDate = allResult.periods.length
      ? Math.min(...allResult.periods.map((period) => period.date))
      : undefined;
    if (!pageMinDate || pageMinDate === loadedFromDate || !allResult.periods.length) {
      isComplete = true;
      break;
    }
    loadedFromDate = pageMinDate;
    if (allResult.minDate && pageMinDate <= allResult.minDate) {
      isComplete = true;
      break;
    }
    if (!untilDate || loadedFromDate <= untilDate) break;
  }

  global = getGlobal();
  const latest = selectTabState(global, tabId).chatCalendar;
  if (latest?.chatId !== chatId) return;

  global = updateTabState(global, {
    chatCalendar: {
      chatId,
      isLoading: false,
      days,
      maxDayCount: Math.max(0, ...Object.values(days).map((day) => day.count)),
      loadedFromDate,
      isComplete,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('resetChatCalendar', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, { chatCalendar: undefined }, tabId);
});
