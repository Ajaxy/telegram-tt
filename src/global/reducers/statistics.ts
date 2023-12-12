import type {
  ApiChannelStatistics, ApiGroupStatistics, ApiPostStatistics, StatisticsGraph,
} from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function updateStatistics<T extends GlobalState>(
  global: T, chatId: string, statistics: ApiChannelStatistics | ApiGroupStatistics,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    statistics: {
      byChatId: {
        ...selectTabState(global, tabId).statistics.byChatId,
        [chatId]: statistics,
      },
    },
  }, tabId);
}

export function updateMessageStatistics<T extends GlobalState>(
  global: T, statistics: ApiPostStatistics,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    statistics: {
      ...selectTabState(global, tabId).statistics,
      currentMessage: statistics,
      currentStory: undefined,
    },
  }, tabId);
}

export function updateStoryStatistics<T extends GlobalState>(
  global: T, statistics: ApiPostStatistics,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    statistics: {
      ...selectTabState(global, tabId).statistics,
      currentStory: statistics,
      currentMessage: undefined,
    },
  }, tabId);
}

export function updateStatisticsGraph<T extends GlobalState>(
  global: T, chatId: string, name: string, update: StatisticsGraph,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { statistics } = selectTabState(global, tabId);
  return updateTabState(global, {
    statistics: {
      ...statistics,
      byChatId: {
        ...statistics.byChatId,
        [chatId]: {
          ...(statistics.byChatId[chatId] || {}),
          [name]: update,
        },
      },
    },
  }, tabId);
}
