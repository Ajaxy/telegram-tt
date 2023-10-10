import type { Api as GramJs } from '../../../lib/gramjs';
import type {
  ApiChannelStatistics,
  ApiGroupStatistics,
  ApiMessagePublicForward,
  ApiMessageStatistics,
  StatisticsGraph,
  StatisticsOverviewItem,
  StatisticsOverviewPercentage,
  StatisticsOverviewPeriod,
} from '../../types';

import { buildAvatarHash } from './chats';
import { buildApiPeerId } from './peers';

export function buildChannelStatistics(stats: GramJs.stats.BroadcastStats): ApiChannelStatistics {
  return {
    // Graphs
    growthGraph: buildGraph(stats.growthGraph),
    followersGraph: buildGraph(stats.followersGraph),
    muteGraph: buildGraph(stats.muteGraph),
    topHoursGraph: buildGraph(stats.topHoursGraph),

    // Async graphs
    languagesGraph: (stats.languagesGraph as GramJs.StatsGraphAsync).token,
    viewsBySourceGraph: (stats.viewsBySourceGraph as GramJs.StatsGraphAsync).token,
    newFollowersBySourceGraph: (stats.newFollowersBySourceGraph as GramJs.StatsGraphAsync).token,
    interactionsGraph: (stats.interactionsGraph as GramJs.StatsGraphAsync).token,

    // Statistics overview
    followers: buildStatisticsOverview(stats.followers),
    viewsPerPost: buildStatisticsOverview(stats.viewsPerPost),
    sharesPerPost: buildStatisticsOverview(stats.sharesPerPost),
    enabledNotifications: buildStatisticsPercentage(stats.enabledNotifications),

    // Recent posts
    recentTopMessages: stats.recentMessageInteractions,
  };
}

export function buildGroupStatistics(stats: GramJs.stats.MegagroupStats): ApiGroupStatistics {
  return {
    // Graphs
    growthGraph: buildGraph(stats.growthGraph),
    membersGraph: buildGraph(stats.membersGraph),
    topHoursGraph: buildGraph(stats.topHoursGraph),

    // Async graphs
    languagesGraph: (stats.languagesGraph as GramJs.StatsGraphAsync).token,
    messagesGraph: (stats.messagesGraph as GramJs.StatsGraphAsync).token,
    actionsGraph: (stats.actionsGraph as GramJs.StatsGraphAsync).token,

    // Statistics overview
    period: getOverviewPeriod(stats.period),
    members: buildStatisticsOverview(stats.members),
    viewers: buildStatisticsOverview(stats.viewers),
    messages: buildStatisticsOverview(stats.messages),
    posters: buildStatisticsOverview(stats.posters),
  };
}

export function buildMessageStatistics(stats: GramJs.stats.MessageStats): ApiMessageStatistics {
  return {
    viewsGraph: buildGraph(stats.viewsGraph),
  };
}

export function buildMessagePublicForwards(
  result: GramJs.messages.TypeMessages,
): ApiMessagePublicForward[] | undefined {
  if (!result || !('messages' in result)) {
    return undefined;
  }

  return result.messages.map((message) => {
    const peerId = buildApiPeerId((message.peerId as GramJs.PeerChannel).channelId, 'channel');
    const channel = result.chats.find((p) => buildApiPeerId(p.id, 'channel') === peerId);

    return {
      messageId: message.id,
      views: (message as GramJs.Message).views,
      title: (channel as GramJs.Channel).title,
      chat: {
        id: peerId,
        type: 'chatTypeChannel',
        title: (channel as GramJs.Channel).title,
        username: (channel as GramJs.Channel).username,
        avatarHash: buildAvatarHash((channel as GramJs.Channel).photo),
      },
    };
  });
}

export function buildGraph(
  result: GramJs.TypeStatsGraph, isPercentage?: boolean,
): StatisticsGraph | undefined {
  if ((result as GramJs.StatsGraphError).error) {
    return undefined;
  }

  const data = JSON.parse((result as GramJs.StatsGraph).json.data);
  const [x, ...y] = data.columns;
  const hasSecondYAxis = data.y_scaled;

  return {
    type: isPercentage ? 'area' : data.types.y0,
    zoomToken: (result as GramJs.StatsGraph).zoomToken,
    labelFormatter: data.xTickFormatter,
    tooltipFormatter: data.xTooltipFormatter,
    labels: x.slice(1),
    hideCaption: !data.subchart.show,
    hasSecondYAxis,
    isStacked: data.stacked && !hasSecondYAxis,
    isPercentage,
    datasets: y.map((item: any) => {
      const key = item[0];

      return {
        name: data.names[key],
        color: extractColor(data.colors[key]),
        values: item.slice(1),
      };
    }),
    ...calculateMinimapRange(data.subchart.defaultZoom, x.slice(1)),
  };
}

function extractColor(color: string): string {
  return color.substring(color.indexOf('#'));
}

function calculateMinimapRange(range: Array<number>, values: Array<number>) {
  const [min, max] = range;

  let minIndex = 0;
  let maxIndex = values.length - 1;

  values.forEach((item, index) => {
    if (!minIndex && item >= min) {
      minIndex = index;
    }

    if (!maxIndex && item >= max) {
      maxIndex = index;
    }
  });

  const begin = Math.max(0, minIndex / (values.length - 1));
  const end = Math.min(1, maxIndex / (values.length - 1));

  return { minimapRange: { begin, end }, labelFromIndex: minIndex, labelToIndex: maxIndex };
}

function buildStatisticsOverview({ current, previous }: GramJs.StatsAbsValueAndPrev): StatisticsOverviewItem {
  const change = current - previous;

  return {
    current,
    change,
    ...(previous && { percentage: (change ? ((Math.abs(change) / previous) * 100) : 0).toFixed(2) }),
  };
}

export function buildStatisticsPercentage(data: GramJs.StatsPercentValue): StatisticsOverviewPercentage {
  return {
    percentage: ((data.part / data.total) * 100).toFixed(2),
  };
}

function getOverviewPeriod(data: GramJs.StatsDateRangeDays): StatisticsOverviewPeriod {
  return {
    maxDate: data.maxDate,
    minDate: data.minDate,
  };
}
