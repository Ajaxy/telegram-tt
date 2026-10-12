import type { TeactNode } from '../../lib/teact/teact';
import {
  memo,
  useCallback,
  useMemo,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChat } from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { GroupedLastMessageItem } from './ChatGroupedLastMessage';

import { getOrderedTopics } from '../../global/helpers';
import { selectTopic } from '../../global/selectors';
import { selectThread } from '../../global/selectors/threads';
import { buildCollectionByCallback, mapTruthyValues } from '../../util/iteratees';

import { useShallowSelector } from '../../hooks/data/useSelector';
import { getIsMobile } from '../../hooks/useAppLayout';
import useLastCallback from '../../hooks/useLastCallback';

import ChatGroupedLastMessage from './ChatGroupedLastMessage';
import TopicIcon from './TopicIcon';

type OwnProps = {
  chat: ApiChat;
  topicIds?: number[];
  hasTags?: boolean;
  renderLastMessage: () => TeactNode | undefined;
  observeIntersection?: ObserveFn;
};

const MAX_TOPICS = 3;

const ChatForumLastMessage = ({
  chat,
  topicIds,
  hasTags,
  renderLastMessage,
  observeIntersection,
}: OwnProps) => {
  const { openThread } = getActions();

  const topicsThreadSelector = useCallback((global: GlobalState) => {
    return buildCollectionByCallback(topicIds || [], (tId) => (
      [tId, selectThread(global, chat.id, tId)]
    ));
  }, [chat.id, topicIds]);
  const topicsThreads = useShallowSelector(topicsThreadSelector);

  const topicsSelector = useCallback((global: GlobalState) => {
    return topicIds?.map((tId) => selectTopic(global, chat.id, tId)).filter(Boolean);
  }, [chat.id, topicIds]);
  const topics = useShallowSelector(topicsSelector);

  const orderedTopics = useMemo(() => {
    if (!topics) {
      return undefined;
    }

    const topicsThreadInfos = mapTruthyValues(topicsThreads, (t) => t?.threadInfo);

    return getOrderedTopics(topics, topicsThreadInfos, undefined, true).slice(0, MAX_TOPICS);
  }, [topics, topicsThreads]);

  const items = useMemo((): GroupedLastMessageItem[] | undefined => {
    return orderedTopics?.map((topic) => ({
      key: topic.id,
      title: topic.title,
      isUnread: Boolean(topicsThreads[topic.id]?.readState?.unreadCount),
      icon: (
        <TopicIcon
          topic={topic}
          observeIntersection={observeIntersection}
        />
      ),
    }));
  }, [orderedTopics, topicsThreads, observeIntersection]);

  const handleMainItemClick = useLastCallback(() => {
    const lastActiveTopic = orderedTopics?.[0];
    if (!lastActiveTopic) return false;
    if (topicsThreads[lastActiveTopic.id]?.readState?.unreadCount === 0
      || (chat.isForumAsMessages && !chat.isBotForum)) {
      return false;
    }

    openThread({
      chatId: chat.id,
      threadId: lastActiveTopic.id,
      shouldReplaceHistory: true,
      noForumTopicPanel: getIsMobile(),
    });

    return true;
  });

  return (
    <ChatGroupedLastMessage
      items={items}
      hasTags={hasTags}
      renderLastMessage={renderLastMessage}
      onMainItemClick={handleMainItemClick}
    />
  );
};

export default memo(ChatForumLastMessage);
