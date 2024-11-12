import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessagePublicForward,
  ApiPostStatistics,
  StatisticsGraph,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { STATISTICS_PUBLIC_FORWARDS_LIMIT } from '../../../config';
import { selectChatFullInfo, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { callApi } from '../../../api/gramjs';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import StatisticsMessagePublicForward from './StatisticsMessagePublicForward';
import StatisticsOverview from './StatisticsOverview';

import styles from './Statistics.module.scss';

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
  reactionsGraph: 'ReactionsByEmotionChartTitle',
};
const GRAPHS = Object.keys(GRAPH_TITLES) as (keyof ApiPostStatistics)[];

export type OwnProps = {
  chatId: string;
  isActive: boolean;
};

export type StateProps = {
  statistics?: ApiPostStatistics;
  messageId?: number;
  dcId?: number;
};

function Statistics({
  chatId,
  isActive,
  statistics,
  dcId,
  messageId,
}: OwnProps & StateProps) {
  const lang = useOldLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<string[]>([]);

  const { loadMessageStatistics, loadMessagePublicForwards, loadStatisticsAsyncGraph } = getActions();
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

  const handleLoadMore = useLastCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards && messageId) {
      loadMessagePublicForwards({ chatId, messageId });
    }
  });

  if (!isReady || !statistics || !messageId) {
    return <Loading />;
  }

  return (
    <div className={buildClassName(styles.root, 'custom-scroll', isReady && styles.ready)}>
      <StatisticsOverview statistics={statistics} type="message" title={lang('StatisticOverview')} />

      {!loadedCharts.current.length && <Loading />}

      <div ref={containerRef}>
        {GRAPHS.map((graph) => (
          <div className={buildClassName(styles.graph, !loadedCharts.current.includes(graph) && styles.hidden)} />
        ))}
      </div>

      {Boolean(statistics.publicForwards) && (
        <div className={styles.publicForwards}>
          <h2 className={styles.publicForwardsTitle}>{lang('Stats.Message.PublicShares')}</h2>

          <InfiniteScroll
            items={statistics.publicForwardsData}
            itemSelector=".statistic-public-forward"
            onLoadMore={handleLoadMore}
            preloadBackwards={STATISTICS_PUBLIC_FORWARDS_LIMIT}
            noFastList
          >
            {(statistics.publicForwardsData as ApiMessagePublicForward[]).map((item) => (
              <StatisticsMessagePublicForward key={item.messageId} data={item} />
            ))}
          </InfiniteScroll>
        </div>
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const dcId = selectChatFullInfo(global, chatId)?.statisticsDcId;
    const tabState = selectTabState(global);
    const statistics = tabState.statistics.currentMessage;
    const messageId = tabState.statistics.currentMessageId;

    return { statistics, dcId, messageId };
  },
)(Statistics));
