import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useState, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { callApi } from '../../../api/gramjs';
import type { ApiMessageStatistics, ApiMessagePublicForward, StatisticsGraph } from '../../../api/types';
import { selectChat, selectTabState } from '../../../global/selectors';

import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';
import useForceUpdate from '../../../hooks/useForceUpdate';

import Loading from '../../ui/Loading';
import StatisticsOverview from './StatisticsOverview';
import StatisticsPublicForward from './StatisticsPublicForward';

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

const GRAPH_TITLES = {
  viewsGraph: 'Stats.MessageInteractionsTitle',
};
const GRAPHS = Object.keys(GRAPH_TITLES) as (keyof ApiMessageStatistics)[];

export type OwnProps = {
  chatId: string;
  isActive: boolean;
};

export type StateProps = {
  statistics?: ApiMessageStatistics;
  messageId?: number;
  dcId?: number;
};

const Statistics: FC<OwnProps & StateProps> = ({
  chatId,
  isActive,
  statistics,
  dcId,
  messageId,
}) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<string[]>([]);

  const { loadMessageStatistics, loadStatisticsAsyncGraph } = getActions();
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (messageId) {
      loadMessageStatistics({ chatId, messageId });
    }
  }, [chatId, loadMessageStatistics, messageId]);

  useEffect(() => {
    if (!isActive || messageId) {
      loadedCharts.current = [];
      setIsReady(false);
    }
  }, [isActive, messageId]);

  // Load async graphs
  useEffect(() => {
    if (!statistics) {
      return;
    }

    GRAPHS.forEach((name) => {
      const graph = statistics[name as keyof typeof statistics];
      const isAsync = typeof graph === 'string';

      if (isAsync) {
        loadStatisticsAsyncGraph({ name, chatId, token: graph });
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

      if (!statistics || !containerRef.current) {
        return;
      }

      GRAPHS.forEach((name, index: number) => {
        const graph = statistics[name as keyof typeof statistics];
        const isAsync = typeof graph === 'string';

        if (isAsync || loadedCharts.current.includes(name)) {
          return;
        }

        if (!graph) {
          loadedCharts.current.push(name);

          return;
        }

        const { zoomToken } = graph as StatisticsGraph;

        LovelyChart.create(
          containerRef.current!.children[index],
          {
            title: lang((GRAPH_TITLES as Record<string, string>)[name]),
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
    isReady, statistics, lang, chatId, messageId, loadStatisticsAsyncGraph, dcId, forceUpdate,
  ]);

  if (!isReady || !statistics || !messageId) {
    return <Loading />;
  }

  return (
    <div className={buildClassName('Statistics custom-scroll', isReady && 'ready')}>
      <StatisticsOverview statistics={statistics} isMessage />

      {!loadedCharts.current.length && <Loading />}

      <div ref={containerRef}>
        {GRAPHS.map((graph) => (
          <div className={buildClassName('Statistics__graph', !loadedCharts.current.includes(graph) && 'hidden')} />
        ))}
      </div>

      {Boolean(statistics.publicForwards) && (
        <div className="Statistics__public-forwards">
          <h2 className="Statistics__public-forwards-title">{lang('Stats.Message.PublicShares')}</h2>

          {statistics.publicForwardsData!.map((item: ApiMessagePublicForward) => (
            <StatisticsPublicForward data={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const dcId = chat?.fullInfo?.statisticsDcId;
    const tabState = selectTabState(global);
    const statistics = tabState.statistics.currentMessage;
    const messageId = tabState.statistics.currentMessageId;

    return { statistics, dcId, messageId };
  },
)(Statistics));
