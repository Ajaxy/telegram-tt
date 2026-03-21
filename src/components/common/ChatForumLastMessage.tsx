import type { TeactNode } from '../../lib/teact/teact';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChat } from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { getOrderedTopics } from '../../global/helpers';
import { selectTopic } from '../../global/selectors';
import { selectThread } from '../../global/selectors/threads';
import buildClassName from '../../util/buildClassName';
import { buildCollectionByCallback, mapTruthyValues } from '../../util/iteratees';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import { useShallowSelector } from '../../hooks/data/useSelector';
import { getIsMobile } from '../../hooks/useAppLayout';
import { useFastClick } from '../../hooks/useFastClick';
import useLang from '../../hooks/useLang';

import TopicIcon from './TopicIcon';

import styles from './ChatForumLastMessage.module.scss';

type OwnProps = {
  chat: ApiChat;
  topicIds?: number[];
  hasTags?: boolean;
  renderLastMessage: () => TeactNode | undefined;
  observeIntersection?: ObserveFn;
};

const NO_CORNER_THRESHOLD = Number(REM);
const MAX_TOPICS = 3;

const ChatForumLastMessage = ({
  chat,
  topicIds,
  hasTags,
  renderLastMessage,
  observeIntersection,
}: OwnProps) => {
  const { openThread } = getActions();

  const lastMessageRef = useRef<HTMLDivElement>();
  const mainColumnRef = useRef<HTMLDivElement>();

  const lang = useLang();

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

  const [lastActiveTopic, ...otherTopics] = useMemo(() => {
    if (!topics) {
      return [];
    }

    const topicsThreadInfos = mapTruthyValues(topicsThreads, (t) => t?.threadInfo);

    return getOrderedTopics(topics, topicsThreadInfos, undefined, true).slice(0, MAX_TOPICS);
  }, [topics, topicsThreads]);

  const lastActiveTopicReadState = lastActiveTopic ? topicsThreads[lastActiveTopic.id]?.readState : undefined;

  const [isReversedCorner, setIsReversedCorner] = useState(false);
  const [overwrittenWidth, setOverwrittenWidth] = useState<number | undefined>(undefined);

  const {
    handleClick: handleOpenTopicClick,
    handleMouseDown: handleOpenTopicMouseDown,
  } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (!lastActiveTopic) return;
    if (lastActiveTopicReadState?.unreadCount === 0 || (chat.isForumAsMessages && !chat.isBotForum)) return;

    e.stopPropagation();
    e.preventDefault();

    openThread({
      chatId: chat.id,
      threadId: lastActiveTopic.id,
      shouldReplaceHistory: true,
      noForumTopicPanel: getIsMobile(),
    });
  });

  useEffect(() => {
    const lastMessageElement = lastMessageRef.current;
    const mainColumnElement = mainColumnRef.current;
    if (!lastMessageElement || !mainColumnElement || hasTags) return;

    const lastMessageWidth = lastMessageElement.offsetWidth;
    const mainColumnWidth = mainColumnElement.offsetWidth;

    if (Math.abs(lastMessageWidth - mainColumnWidth) < NO_CORNER_THRESHOLD) {
      setOverwrittenWidth(Math.max(lastMessageWidth, mainColumnWidth));
    } else {
      setOverwrittenWidth(undefined);
    }
    setIsReversedCorner(lastMessageWidth > mainColumnWidth);
  }, [lastActiveTopic, renderLastMessage, hasTags]);

  return (
    <div
      className={buildClassName(
        styles.root,
        isReversedCorner && styles.reverseCorner,
        overwrittenWidth && styles.overwrittenWidth,
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
      style={overwrittenWidth ? `--overwritten-width: ${overwrittenWidth}px` : undefined}
    >
      {
        !hasTags && (
          <>
            {lastActiveTopic && (
              <div className={styles.titleRow}>
                <div
                  className={buildClassName(
                    styles.mainColumn,
                    lastActiveTopicReadState?.unreadCount && styles.unread,
                  )}
                  ref={mainColumnRef}
                  onClick={handleOpenTopicClick}
                  onMouseDown={handleOpenTopicMouseDown}
                >
                  <TopicIcon
                    topic={lastActiveTopic}
                    observeIntersection={observeIntersection}
                  />
                  <div className={styles.title}>{renderText(lastActiveTopic.title)}</div>
                  {!overwrittenWidth && isReversedCorner && (
                    <div className={styles.afterWrapper}>
                      <div className={styles.after} />
                    </div>
                  )}
                </div>

                <div className={styles.otherColumns}>
                  {otherTopics.map((topic) => (
                    <div
                      className={buildClassName(
                        styles.otherColumn, topicsThreads[topic.id]?.readState?.unreadCount && styles.unread,
                      )}
                      key={topic.id}
                    >
                      <TopicIcon
                        topic={topic}
                        className={styles.otherColumnIcon}
                        observeIntersection={observeIntersection}
                      />
                      <span className={styles.otherColumnTitle}>{renderText(topic.title)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.ellipsis} />
              </div>
            )}
            {!lastActiveTopic && (
              <div className={buildClassName(styles.titleRow, styles.loading)}>
                {lang('Loading')}
              </div>
            )}
          </>
        )
      }
      <div
        className={buildClassName(
          styles.lastMessage,
          lastActiveTopicReadState?.unreadCount && !hasTags && styles.unread,
        )}
        ref={lastMessageRef}
        onClick={handleOpenTopicClick}
        onMouseDown={handleOpenTopicMouseDown}
      >
        {renderLastMessage()}
        {!overwrittenWidth && !isReversedCorner && (
          <div className={styles.afterWrapper}>
            <div className={styles.after} />
          </div>
        )}
      </div>

    </div>
  );
};

export default memo(ChatForumLastMessage);
