import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useState, useEffect, useRef, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { callApi } from '../../../api/gramjs';
import type {
  ApiMessage,
  ApiChannelStatistics,
  ApiGroupStatistics,
  StatisticsRecentMessage as StatisticsRecentMessageType,
  StatisticsGraph,
} from '../../../api/types';
import { selectChat, selectStatistics } from '../../../global/selectors';

import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';
import useForceUpdate from '../../../hooks/useForceUpdate';

import Loading from '../../ui/Loading';
import StatisticsOverview from './StatisticsOverview';
import StatisticsRecentMessage from './StatisticsRecentMessage';

import './Statistics.scss';

type ILovelyChart = { create: Function };
let lovelyChartPromise: Promise<ILovelyChart>;
let LovelyChart: ILovelyChart;

async function ensureLovelyChart() {
  if (!lovelyChartPromise) {
    lovelyChartPromise = import('../../../lib/lovely-chart/LovelyChart') as Promise<ILovelyChart>;
    LovelyChart = await lovelyChartPromise;
  }

  return lovelyChartPromise;
}

const CHANNEL_GRAPHS_TITLES = {
  growthGraph: 'ChannelStats.Graph.Growth',
  followersGraph: 'ChannelStats.Graph.Followers',
  muteGraph: 'ChannelStats.Graph.Notifications',
  topHoursGraph: 'ChannelStats.Graph.ViewsByHours',
  viewsBySourceGraph: 'ChannelStats.Graph.ViewsBySource',
  newFollowersBySourceGraph: 'ChannelStats.Graph.NewFollowersBySource',
  languagesGraph: 'ChannelStats.Graph.Language',
  interactionsGraph: 'ChannelStats.Graph.Interactions',
};
const CHANNEL_GRAPHS = Object.keys(CHANNEL_GRAPHS_TITLES) as (keyof ApiChannelStatistics)[];

const GROUP_GRAPHS_TITLES = {
  growthGraph: 'Stats.GroupGrowthTitle',
  membersGraph: 'Stats.GroupMembersTitle',
  languagesGraph: 'Stats.GroupLanguagesTitle',
  messagesGraph: 'Stats.GroupMessagesTitle',
  actionsGraph: 'Stats.GroupActionsTitle',
  topHoursGraph: 'Stats.GroupTopHoursTitle',
};
const GROUP_GRAPHS = Object.keys(GROUP_GRAPHS_TITLES) as (keyof ApiGroupStatistics)[];

export type OwnProps = {
  chatId: string;
  isActive: boolean;
};

export type StateProps = {
  statistics: ApiChannelStatistics | ApiGroupStatistics;
  dcId?: number;
  isGroup: boolean;
  messageId?: number;
};

const Statistics: FC<OwnProps & StateProps> = ({
  chatId,
  isActive,
  statistics,
  dcId,
  isGroup,
  messageId,
}) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<string[]>([]);

  const { loadStatistics, loadStatisticsAsyncGraph } = getActions();
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    loadStatistics({ chatId, isGroup });
  }, [chatId, loadStatistics, isGroup]);

  useEffect(() => {
    if (!isActive) {
      loadedCharts.current = [];
      setIsReady(false);
    }
  }, [isActive]);

  const graphs = useMemo(() => {
    return isGroup ? GROUP_GRAPHS : CHANNEL_GRAPHS;
  }, [isGroup]);

  const graphTitles = useMemo(() => {
    return isGroup ? GROUP_GRAPHS_TITLES : CHANNEL_GRAPHS_TITLES;
  }, [isGroup]);

  // Load async graphs
  useEffect(() => {
    if (!statistics) {
      return;
    }

    graphs.forEach((name) => {
      const graph = statistics[name as keyof typeof statistics];
      const isAsync = typeof graph === 'string';

      if (isAsync) {
        loadStatisticsAsyncGraph({
          name,
          chatId,
          token: graph,
          // Hardcode percentage for languages graph, since API does not return `percentage` flag
          isPercentage: name === 'languagesGraph',
        });
      }
    });
  }, [graphs, chatId, statistics, loadStatisticsAsyncGraph]);

  useEffect(() => {
    (async () => {
      await ensureLovelyChart();

      if (!isReady) {
        setIsReady(true);
        return;
      }

      if (!statistics || !containerRef.current) {
        return;
      }

      graphs.forEach((name, index: number) => {
        const graph = statistics[name as keyof typeof statistics];
        const isAsync = typeof graph === 'string';

        if (isAsync || loadedCharts.current.includes(name)) {
          return;
        }

        if (!graph) {
          loadedCharts.current.push(name);

          return;
        }

        const { zoomToken } = graph;

        LovelyChart.create(
          containerRef.current!.children[index],
          {
            title: lang((graphTitles as Record<string, string>)[name]),
            ...zoomToken ? {
              onZoom: (x: number) => callApi('fetchStatisticsAsyncGraph', { token: zoomToken, x, dcId }),
              zoomOutLabel: lang('Graph.ZoomOut'),
            } : {},
            ...graph as StatisticsGraph,
          },
        );

        loadedCharts.current.push(name);
      });

      forceUpdate();
    })();
  }, [
    graphs, graphTitles, isReady, statistics, lang, chatId, loadStatisticsAsyncGraph, dcId, forceUpdate,
  ]);

  if (!isReady || !statistics || messageId) {
    return <Loading />;
  }

  return (
    <div className={buildClassName('Statistics custom-scroll', isReady && 'ready')}>
      <StatisticsOverview statistics={statistics} isGroup={isGroup} />

      {!loadedCharts.current.length && <Loading />}

      <div ref={containerRef}>
        {graphs.map((graph) => (
          <div className={buildClassName('Statistics__graph', !loadedCharts.current.includes(graph) && 'hidden')} />
        ))}
      </div>

      {Boolean((statistics as ApiChannelStatistics).recentTopMessages?.length) && (
        <div className="Statistics__messages">
          <h2 className="Statistics__messages-title">{lang('ChannelStats.Recent.Header')}</h2>

          {(statistics as ApiChannelStatistics).recentTopMessages.map((message) => (
            <StatisticsRecentMessage message={message as ApiMessage & StatisticsRecentMessageType} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const statistics = selectStatistics(global, chatId);
    const chat = selectChat(global, chatId);
    const dcId = chat?.fullInfo?.statisticsDcId;
    const isGroup = chat?.type === 'chatTypeSuperGroup';
    // Show Loading component if message was already selected for improving transition animation
    const messageId = global.statistics.currentMessageId;

    return {
      statistics, dcId, isGroup, messageId,
    };
  },
)(Statistics));
