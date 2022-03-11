import { Api as GramJs } from '../../../lib/gramjs';
import {
  ApiStatistics,
  StatisticsGraph,
  StatisticsOverviewItem,
  StatisticsOverviewPercentage,
} from '../../types';

export function buildStatistics(stats: GramJs.stats.BroadcastStats): ApiStatistics {
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

export function buildGraph(result: GramJs.TypeStatsGraph, isPercentage?: boolean): StatisticsGraph {
  if ((result as GramJs.StatsGraphError).error) {
    throw new Error((result as GramJs.StatsGraphError).error);
  }

  const data = JSON.parse((result as GramJs.StatsGraph).json.data);
  const [x, ...y] = data.columns;
  const hasSecondYAxis = data.y_scaled;

  return {
    type: getGraphType(data.types.y0, isPercentage),
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

function getGraphType(apiType: string, isPercentage?: boolean): string {
  switch (apiType) {
    case 'step':
      return 'bar';
    default:
      return isPercentage ? 'area' : apiType;
  }
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

function buildStatisticsPercentage(data: GramJs.StatsPercentValue): StatisticsOverviewPercentage {
  return {
    percentage: ((data.part / data.total) * 100).toFixed(2),
  };
}
