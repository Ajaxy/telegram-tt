import React, {
  FC, memo, useState, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { callApi } from '../../../api/gramjs';
import {
  ApiMessage, ApiStatistics, StatisticsRecentMessage as StatisticsRecentMessageType, StatisticsGraph,
} from '../../../api/types';
import { selectChat, selectStatistics } from '../../../modules/selectors';

import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';

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

const GRAPHS_TITLES = {
  growthGraph: 'ChannelStats.Graph.Growth',
  followersGraph: 'ChannelStats.Graph.Followers',
  muteGraph: 'ChannelStats.Graph.Notifications',
  topHoursGraph: 'ChannelStats.Graph.ViewsByHours',
  viewsBySourceGraph: 'ChannelStats.Graph.ViewsBySource',
  newFollowersBySourceGraph: 'ChannelStats.Graph.NewFollowersBySource',
  languagesGraph: 'ChannelStats.Graph.Language',
  interactionsGraph: 'ChannelStats.Graph.Interactions',
};
const GRAPHS = Object.keys(GRAPHS_TITLES) as (keyof ApiStatistics)[];

export type OwnProps = {
  chatId: string;
  isActive: boolean;
};

export type StateProps = {
  statistics: ApiStatistics;
  dcId?: number;
};

const Statistics: FC<OwnProps & StateProps> = ({
  chatId, isActive, statistics, dcId,
}) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<string[]>([]);

  const { loadStatistics, loadStatisticsAsyncGraph } = getDispatch();

  useEffect(() => {
    loadStatistics({ chatId });
  }, [chatId, loadStatistics]);

  useEffect(() => {
    if (!isActive) {
      loadedCharts.current = [];
    }
  }, [isActive]);

  // Load async graphs
  useEffect(() => {
    if (!statistics) {
      return;
    }

    GRAPHS.forEach((graph) => {
      const isAsync = typeof statistics?.[graph] === 'string';
      if (isAsync) {
        loadStatisticsAsyncGraph({
          name: graph,
          chatId,
          token: statistics[graph],
          // Hardcode percentage for languages graph, since API does not return `percentage` flag
          isPercentage: graph === 'languagesGraph',
        });
      }
    });
  }, [chatId, statistics, loadStatisticsAsyncGraph]);

  useEffect(() => {
    (async () => {
      await ensureLovelyChart();

      if (!isReady) {
        setIsReady(true);
        return;
      }

      if (!statistics) {
        return;
      }

      GRAPHS.forEach((graph, index: number) => {
        const isAsync = typeof statistics?.[graph] === 'string';
        if (isAsync || loadedCharts.current.includes(graph)) {
          return;
        }

        const { zoomToken } = (statistics[graph] as StatisticsGraph);

        LovelyChart.create(
          containerRef.current!.children[index],
          {
            title: lang((GRAPHS_TITLES as Record<string, string>)[graph]),
            ...zoomToken && {
              onZoom: (x: number) => callApi('fetchStatisticsAsyncGraph', { token: zoomToken, x, dcId }),
              zoomOutLabel: lang('Graph.ZoomOut'),
            },
            ...(statistics[graph] as StatisticsGraph),
          },
        );

        loadedCharts.current.push(graph);
      });
    })();
  }, [isReady, statistics, lang, chatId, loadStatisticsAsyncGraph, dcId]);

  if (!isReady || !statistics) {
    return <Loading />;
  }

  return (
    <div className={buildClassName('Statistics custom-scroll', isReady && 'ready')}>
      <StatisticsOverview statistics={statistics} />

      {!loadedCharts.current.length && <Loading />}

      <div ref={containerRef}>
        {GRAPHS.map((graph) => (
          <div className={buildClassName('chat-container', !loadedCharts.current.includes(graph) && 'hidden')} />
        ))}
      </div>

      {Boolean(statistics.recentTopMessages?.length) && (
        <div className="Statistics--messages">
          <h2 className="Statistics--messages-title">{lang('ChannelStats.Recent.Header')}</h2>

          {statistics.recentTopMessages.map((message) => (
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
    const dcId = selectChat(global, chatId)?.fullInfo?.statisticsDcId;

    return { statistics, dcId };
  },
)(Statistics));
