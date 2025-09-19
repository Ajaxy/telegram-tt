import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessagePublicForward,
  ApiPostStatistics,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { selectChatFullInfo, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { callApi } from '../../../api/gramjs';
import { isGraph } from './helpers/isGraph';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import StatisticsMessagePublicForward from './StatisticsMessagePublicForward';
import StatisticsOverview from './StatisticsOverview';

import styles from './Statistics.module.scss';

type ILovelyChart = { create: (el: HTMLElement, params: AnyLiteral) => void };
let lovelyChartPromise: Promise<ILovelyChart> | undefined;
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

function MessageStatistics({
  chatId,
  isActive,
  statistics,
  dcId,
  messageId,
}: OwnProps & StateProps) {
  const lang = useOldLang();
  const containerRef = useRef<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<Set<string>>(new Set());
  const errorCharts = useRef<Set<string>>(new Set());

  const { loadMessageStatistics, loadMessagePublicForwards, loadStatisticsAsyncGraph } = getActions();
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (messageId) {
      loadMessageStatistics({ chatId, messageId });
    }
  }, [chatId, loadMessageStatistics, messageId]);

  useEffect(() => {
    if (!isActive || messageId) {
      loadedCharts.current.clear();
      errorCharts.current.clear();
      setIsReady(false);
    }
  }, [isActive, messageId]);

  // Load async graphs
  useEffect(() => {
    if (!statistics) {
      return;
    }

    GRAPHS.forEach((name) => {
      const graph = statistics[name];
      if (!isGraph(graph)) {
        return;
      }
      const isAsync = graph.graphType === 'async';

      if (isAsync) {
        loadStatisticsAsyncGraph({ name, chatId, token: graph.token });
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
        const graph = statistics[name];
        if (!isGraph(graph)) {
          return;
        }
        const isAsync = graph.graphType === 'async';
        const isError = graph.graphType === 'error';

        if (isAsync || loadedCharts.current.has(name)) {
          return;
        }

        if (isError) {
          loadedCharts.current.add(name);
          errorCharts.current.add(name);

          return;
        }

        const { zoomToken } = graph;

        LovelyChart.create(
          containerRef.current!.children[index] as HTMLElement,
          {
            title: lang((GRAPH_TITLES as Record<string, string>)[name]),
            ...zoomToken ? {
              onZoom: (x: number) => callApi('fetchStatisticsAsyncGraph', { token: zoomToken, x, dcId }),
              zoomOutLabel: lang('Graph.ZoomOut'),
            } : {},
            ...graph,
          },
        );

        loadedCharts.current.add(name);
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
    <div
      key={`${chatId}-${messageId}`}
      className={buildClassName(styles.root, 'custom-scroll', isReady && styles.ready)}
    >
      <StatisticsOverview statistics={statistics} type="message" title={lang('StatisticOverview')} />

      {(!loadedCharts.current.size || !statistics.publicForwardsData) && <Loading />}

      <div ref={containerRef}>
        {GRAPHS.map((graph) => {
          const isGraphReady = loadedCharts.current.has(graph) && !errorCharts.current.has(graph);
          return (
            <div className={buildClassName(styles.graph, !isGraphReady && styles.hidden)} />
          );
        })}
      </div>

      {Boolean(statistics.publicForwards) && (
        <div className={styles.publicForwards}>
          <h2 className={styles.publicForwardsTitle}>{lang('Stats.Message.PublicShares')}</h2>

          <InfiniteScroll
            items={statistics.publicForwardsData}
            itemSelector=".statistic-public-forward"
            onLoadMore={handleLoadMore}
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
  (global, { chatId }): Complete<StateProps> => {
    const dcId = selectChatFullInfo(global, chatId)?.statisticsDcId;
    const tabState = selectTabState(global);
    const statistics = tabState.statistics.currentMessage;
    const messageId = tabState.statistics.currentMessageId;

    return { statistics, dcId, messageId };
  },
)(MessageStatistics));
