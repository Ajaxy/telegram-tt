import React, {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { FC } from '../../lib/teact/teact';
import type { ApiChat } from '../../api/types';

import { REM } from './helpers/mediaDimensions';
import buildClassName from '../../util/buildClassName';
import { getOrderedTopics } from '../../global/helpers';
import renderText from './helpers/renderText';
import useLang from '../../hooks/useLang';

import TopicIcon from './TopicIcon';

import styles from './ChatForumLastMessage.module.scss';

type OwnProps = {
  chat: ApiChat;
  renderLastMessage: () => React.ReactNode;
  observeIntersection?: ObserveFn;
};

const NO_CORNER_THRESHOLD = Number(REM);
const MAX_TOPICS = 3;

const ChatForumLastMessage: FC<OwnProps> = ({
  chat,
  renderLastMessage,
  observeIntersection,
}) => {
  const { openChat } = getActions();

  // eslint-disable-next-line no-null/no-null
  const lastMessageRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const mainColumnRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  const lastMessage = renderLastMessage();

  const [lastActiveTopic, ...otherTopics] = useMemo(() => {
    if (!chat.topics) {
      return [];
    }

    return getOrderedTopics(Object.values(chat.topics), undefined, true).slice(0, MAX_TOPICS);
  }, [chat.topics]);

  const [isReversedCorner, setIsReversedCorner] = useState(false);
  const [overwrittenWidth, setOverwrittenWidth] = useState<number | undefined>(undefined);

  function handleOpenTopic(e: React.MouseEvent<HTMLDivElement>) {
    if (lastActiveTopic.unreadCount === 0) return;
    e.stopPropagation();
    openChat({ id: chat.id, threadId: lastActiveTopic.id, shouldReplaceHistory: true });
  }

  useLayoutEffect(() => {
    const lastMessageElement = lastMessageRef.current;
    const mainColumnElement = mainColumnRef.current;
    if (!lastMessageElement || !mainColumnElement) return;

    const lastMessageWidth = lastMessageElement.offsetWidth;
    const mainColumnWidth = mainColumnElement.offsetWidth;

    if (Math.abs(lastMessageWidth - mainColumnWidth) < NO_CORNER_THRESHOLD) {
      setOverwrittenWidth(Math.max(lastMessageWidth, mainColumnWidth));
    } else {
      setOverwrittenWidth(undefined);
    }
    setIsReversedCorner(lastMessageWidth > mainColumnWidth);
  }, [lastActiveTopic, lastMessage]);

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
      {lastActiveTopic && (
        <div className={styles.titleRow}>
          <div
            className={buildClassName(
              styles.mainColumn,
              lastActiveTopic.unreadCount && styles.unread,
            )}
            ref={mainColumnRef}
            onMouseDown={handleOpenTopic}
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
                  styles.otherColumn, topic.unreadCount && styles.unread,
                )}
                key={topic.id}
              >
                <TopicIcon
                  topic={topic}
                  observeIntersection={observeIntersection}
                />
                <span className={styles.otherColumnTitle}>{renderText(topic.title)}</span>
              </div>
            ))}
          </div>

          <div className={styles.ellipsis} />
        </div>
      )}
      {!lastActiveTopic && <div className={buildClassName(styles.titleRow, styles.loading)}>{lang('Loading')}</div>}
      <div
        className={buildClassName(styles.lastMessage, lastActiveTopic?.unreadCount && styles.unread)}
        ref={lastMessageRef}
        onMouseDown={handleOpenTopic}
      >
        {lastMessage}
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
