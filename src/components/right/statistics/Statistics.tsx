import {
  memo, useEffect, useMemo,
  useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChannelStatistics,
  ApiChat,
  ApiGroupStatistics,
  ApiMessage,
  ApiTypeStory,
} from '../../../api/types';

import {
  selectChat,
  selectChatFullInfo,
  selectChatMessages,
  selectPeerStories,
  selectStatistics,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { callApi } from '../../../api/gramjs';
import { isGraph } from './helpers/isGraph';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useOldLang from '../../../hooks/useOldLang';

import Loading from '../../ui/Loading';
import StatisticsOverview from './StatisticsOverview';
import StatisticsRecentMessage from './StatisticsRecentMessage';
import StatisticsRecentStory from './StatisticsRecentStory';

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

const CHANNEL_GRAPHS_TITLES = {
  growthGraph: 'ChannelStats.Graph.Growth',
  followersGraph: 'ChannelStats.Graph.Followers',
  muteGraph: 'ChannelStats.Graph.Notifications',
  topHoursGraph: 'ChannelStats.Graph.ViewsByHours',
  viewsBySourceGraph: 'ChannelStats.Graph.ViewsBySource',
  newFollowersBySourceGraph: 'ChannelStats.Graph.NewFollowersBySource',
  languagesGraph: 'ChannelStats.Graph.Language',
  interactionsGraph: 'ChannelStats.Graph.Interactions',
  reactionsByEmotionGraph: 'ChannelStats.Graph.Reactions',
  storyInteractionsGraph: 'ChannelStats.Graph.Stories',
  storyReactionsByEmotionGraph: 'ChannelStats.Graph.StoriesReactions',
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
};

export type StateProps = {
  chat?: ApiChat;
  statistics: ApiChannelStatistics | ApiGroupStatistics;
  dcId?: number;
  isGroup: boolean;
  messagesById: Record<string, ApiMessage>;
  storiesById?: Record<string, ApiTypeStory>;
};

const Statistics = ({
  chatId,
  chat,
  statistics,
  dcId,
  isGroup,
  messagesById,
  storiesById,
}: OwnProps & StateProps) => {
  const lang = useOldLang();
  const containerRef = useRef<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  const loadedCharts = useRef<Set<string>>(new Set());
  const errorCharts = useRef<Set<string>>(new Set());

  const { loadStatistics, loadStatisticsAsyncGraph } = getActions();
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    loadStatistics({ chatId, isGroup });
  }, [chatId, loadStatistics, isGroup]);

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
      if (!isGraph(graph)) {
        return;
      }
      const isAsync = graph.graphType === 'async';

      if (isAsync) {
        loadStatisticsAsyncGraph({
          name,
          chatId,
          token: graph.token,
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
            title: lang((graphTitles as Record<string, string>)[name]),
            ...zoomToken ? {
              onZoom: (x: number) => callApi('fetchStatisticsAsyncGraph', { token: zoomToken, x, dcId }),
              zoomOutLabel: lang('Graph.ZoomOut'),
            } : {},
            ...graph,
          },
        );

        loadedCharts.current.add(name);

        containerRef.current!.children[index].classList.remove(styles.hidden);
      });

      forceUpdate();
    })();
  }, [
    graphs, graphTitles, isReady, statistics, lang, chatId, loadStatisticsAsyncGraph, dcId, forceUpdate,
  ]);

  return (
    <div className={buildClassName(styles.root, 'panel-content custom-scroll', isReady && styles.ready)}>
      {statistics && (
        <StatisticsOverview
          statistics={statistics}
          type={isGroup ? 'group' : 'channel'}
          title={lang('StatisticOverview')}
        />
      )}

      {!loadedCharts.current.size && <Loading />}

      <div ref={containerRef}>
        {graphs.map((graph) => {
          const isGraphReady = loadedCharts.current.has(graph) && !errorCharts.current.has(graph);
          return (
            <div className={buildClassName(styles.graph, !isGraphReady && styles.hidden)} />
          );
        })}
      </div>

      {Boolean((statistics as ApiChannelStatistics)?.recentPosts?.length) && (
        <div className={styles.messages}>
          <h2 className={styles.messagesTitle}>{lang('ChannelStats.Recent.Header')}</h2>

          {(statistics as ApiChannelStatistics).recentPosts.map((postStatistic) => {
            if ('msgId' in postStatistic) {
              const message = messagesById[postStatistic.msgId];
              if (!message || !('content' in message)) return undefined;

              return (
                <StatisticsRecentMessage
                  key={`statistic_message_${postStatistic.msgId}`}
                  message={message}
                  postStatistic={postStatistic}
                />
              );
            }

            if ('storyId' in postStatistic && chat) {
              const story = storiesById?.[postStatistic.storyId];

              return (
                <StatisticsRecentStory
                  key={`statistic_story_${postStatistic.storyId}`}
                  chat={chat}
                  story={story}
                  postStatistic={postStatistic}
                />
              );
            }

            return undefined;
          })}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const statistics = selectStatistics(global, chatId);
    const chat = selectChat(global, chatId);
    const dcId = selectChatFullInfo(global, chatId)?.statisticsDcId;
    const isGroup = chat?.type === 'chatTypeSuperGroup';
    const messagesById = selectChatMessages(global, chatId);
    const storiesById = selectPeerStories(global, chatId)?.byId;

    return {
      statistics, dcId, isGroup, chat, messagesById, storiesById,
    };
  },
)(Statistics));
