import type { GlobalState } from '../types';
import type {
  ApiChannelStatistics, ApiGroupStatistics, ApiMessageStatistics, StatisticsGraph,
} from '../../api/types';

export function updateStatistics(
  global: GlobalState, chatId: string, statistics: ApiChannelStatistics | ApiGroupStatistics,
): GlobalState {
  return {
    ...global,
    statistics: {
      byChatId: {
        ...global.statistics.byChatId,
        [chatId]: statistics,
      },
    },
  };
}

export function updateMessageStatistics(
  global: GlobalState, statistics: ApiMessageStatistics,
): GlobalState {
  return {
    ...global,
    statistics: {
      ...global.statistics,
      currentMessage: statistics,
    },
  };
}

export function updateStatisticsGraph(
  global: GlobalState, chatId: string, name: string, update: StatisticsGraph,
): GlobalState {
  return {
    ...global,
    statistics: {
      ...global.statistics,
      byChatId: {
        ...global.statistics.byChatId,
        [chatId]: {
          ...(global.statistics.byChatId[chatId] || {}),
          [name]: update,
        },
      },
    },
  };
}
