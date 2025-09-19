import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
  ApiPostStatistics,
  ApiUser,
} from '../../../api/types';

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
import StatisticsStoryPublicForward from './StatisticsStoryPublicForward';

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
  viewsGraph: 'Stats.StoryInteractionsTitle',
  reactionsGraph: 'ReactionsByEmotionChartTitle',
};
const GRAPHS = Object.keys(GRAPH_TITLES) as (keyof ApiPostStatistics)[];

export type OwnProps = {
  chatId: string;
  isActive: boolean;
};

export type StateProps = {
  statistics?: ApiPostStatistics;
  storyId?: number;
  dcId?: number;
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
};

function StoryStatistics({
  chatId,
  isActive,
  statistics,
  dcId,
  storyId,
  chatsById,
  usersById,
}: OwnProps & StateProps) {
  const lang = useOldLang();
  const containerRef = useRef<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<Set<string>>(new Set());
  const errorCharts = useRef<Set<string>>(new Set());

  const { loadStoryStatistics, loadStoryPublicForwards, loadStatisticsAsyncGraph } = getActions();
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (storyId) {
      loadStoryStatistics({ chatId, storyId });
    }
  }, [chatId, storyId]);

  useEffect(() => {
    if (!isActive || storyId) {
      loadedCharts.current.clear();
      errorCharts.current.clear();
      setIsReady(false);
    }
  }, [isActive, storyId]);

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
    isReady, statistics, lang, chatId, storyId, loadStatisticsAsyncGraph, dcId, forceUpdate,
  ]);

  const handleLoadMore = useLastCallback(() => {
    if (!storyId) return;

    loadStoryPublicForwards({ chatId, storyId });
  });

  if (!isReady || !statistics || !storyId) {
    return <Loading />;
  }

  return (
    <div
      key={`${chatId}-${storyId}`}
      className={buildClassName(styles.root, 'custom-scroll', isReady && styles.ready)}
    >
      <StatisticsOverview statistics={statistics} type="story" title={lang('StatisticOverview')} />

      {!loadedCharts.current.size && <Loading />}

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
            {statistics.publicForwardsData!.map((item) => {
              if ('messageId' in item) {
                return (
                  <StatisticsMessagePublicForward key={`message_${item.messageId}`} data={item} />
                );
              }

              return (
                <StatisticsStoryPublicForward
                  key={`story_${item.storyId}`}
                  data={item}
                  chatsById={chatsById}
                  usersById={usersById}
                />
              );
            })}
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
    const statistics = tabState.statistics.currentStory;
    const storyId = tabState.statistics.currentStoryId;
    const { byId: usersById } = global.users;
    const { byId: chatsById } = global.chats;

    return {
      statistics, dcId, storyId, usersById, chatsById,
    };
  },
)(StoryStatistics));
