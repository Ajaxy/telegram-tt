import { GlobalState } from '../types';
import { ApiChannelStatistics, ApiGroupStatistics, StatisticsGraph } from '../../api/types';

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

export function updateStatisticsGraph(
  global: GlobalState, chatId: string, name: string, update: StatisticsGraph,
): GlobalState {
  return {
    ...global,
    statistics: {
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
