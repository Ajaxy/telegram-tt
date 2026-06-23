import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessagePublicForward,
  ApiPostStatistics,
} from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import ensureLovelyChart from '../../../lib/lovelyChartWithStyles';
import { selectChatFullInfo, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { callApi } from '../../../api/gramjs';
import { isGraph } from './helpers/isGraph';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Island, { IslandTitle } from '../../gili/layout/Island';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import StatisticsMessagePublicForward from './StatisticsMessagePublicForward';
import StatisticsOverview from './StatisticsOverview';

import styles from './Statistics.module.scss';

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
  const lang = useLang();
  const oldLang = useOldLang();
  const containerRef = useRef<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  const loadedChartsRef = useRef<Set<string>>(new Set());
  const errorChartsRef = useRef<Set<string>>(new Set());

  const { loadMessageStatistics, loadMessagePublicForwards, loadStatisticsAsyncGraph } = getActions();
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (messageId) {
      loadMessageStatistics({ chatId, messageId });
    }
  }, [chatId, loadMessageStatistics, messageId]);

  useEffect(() => {
    if (!isActive || messageId) {
      loadedChartsRef.current.clear();
      errorChartsRef.current.clear();
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
      const LovelyChart = await ensureLovelyChart();

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

        if (isAsync || loadedChartsRef.current.has(name)) {
          return;
        }

        if (isError) {
          loadedChartsRef.current.add(name);
          errorChartsRef.current.add(name);

          return;
        }

        const { zoomToken } = graph;

        new LovelyChart(containerRef.current!.children[index] as HTMLElement, {
          ...graph,
          title: oldLang((GRAPH_TITLES as Record<string, string>)[name]),
          onZoom: zoomToken
            ? (x: number) => callApi('fetchStatisticsAsyncGraph', { token: zoomToken, x, dcId })
            : undefined,
          zoomOutLabel: zoomToken ? oldLang('Graph.ZoomOut') : undefined,
        });

        loadedChartsRef.current.add(name);
      });

      forceUpdate();
    })();
  }, [
    isReady, statistics, oldLang, chatId, messageId, loadStatisticsAsyncGraph, dcId, forceUpdate,
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
      <IslandTitle>{lang('StatisticOverview')}</IslandTitle>
      <Island>
        <StatisticsOverview statistics={statistics} type="message" />
      </Island>

      {(!loadedChartsRef.current.size || !statistics.publicForwardsData) && <Loading />}

      <div ref={containerRef} className={styles.graphContainer} data-stricterdom-ignore>
        {GRAPHS.map((graph) => {
          const isGraphReady = loadedChartsRef.current.has(graph) && !errorChartsRef.current.has(graph);
          return (
            <div className={buildClassName(styles.graph, !isGraphReady && styles.hidden)} />
          );
        })}
      </div>

      {Boolean(statistics.publicForwards) && (
        <div className={styles.publicForwards}>
          <IslandTitle>{lang('StatsMessagePublicShares')}</IslandTitle>
          <Island>
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
          </Island>
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
