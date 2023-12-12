import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
  ApiPostStatistics,
  ApiUser,
  StatisticsGraph,
} from '../../../api/types';

import { STATISTICS_PUBLIC_FORWARDS_LIMIT } from '../../../config';
import { selectChatFullInfo, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { callApi } from '../../../api/gramjs';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import StatisticsMessagePublicForward from './StatisticsMessagePublicForward';
import StatisticsOverview from './StatisticsOverview';
import StatisticsStoryPublicForward from './StatisticsStoryPublicForward';

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
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<string[]>([]);

  const { loadStoryStatistics, loadStoryPublicForwards, loadStatisticsAsyncGraph } = getActions();
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (storyId) {
      loadStoryStatistics({ chatId, storyId });
    }
  }, [chatId, storyId]);

  useEffect(() => {
    if (!isActive || storyId) {
      loadedCharts.current = [];
      setIsReady(false);
    }
  }, [isActive, storyId]);

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
    <div className={buildClassName(styles.root, 'custom-scroll', isReady && styles.ready)}>
      <StatisticsOverview statistics={statistics} type="story" title={lang('StatisticOverview')} />

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
  (global, { chatId }): StateProps => {
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
