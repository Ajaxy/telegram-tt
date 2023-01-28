import type { GlobalState, TabArgs } from '../types';
import type {
  ApiChannelStatistics, ApiGroupStatistics, ApiMessageStatistics, StatisticsGraph,
} from '../../api/types';
import { updateTabState } from './tabs';
import { selectTabState } from '../selectors';
import { getCurrentTabId } from '../../util/establishMultitabRole';

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
  global: T, statistics: ApiMessageStatistics,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    statistics: {
      ...selectTabState(global, tabId).statistics,
      currentMessage: statistics,
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
