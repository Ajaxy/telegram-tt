import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiChat } from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';

import {
  GENERAL_TOPIC_ID,
  TOPICS_SLICE, TOPIC_HEIGHT_PX, TOPIC_LIST_SENSITIVE_AREA,
} from '../../../config';
import { selectChat, selectCurrentMessageList } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { fastRaf } from '../../../util/schedulers';
import { getOrderedTopics } from '../../../global/helpers';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { waitForTransitionEnd } from '../../../util/cssAnimationEndListeners';

import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { useIntersectionObserver, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useChatOrderDiff from './hooks/useChatOrderDiff';
import useLang from '../../../hooks/useLang';
import usePrevious from '../../../hooks/usePrevious';
import useHistoryBack from '../../../hooks/useHistoryBack';
import { dispatchHeavyAnimationEvent } from '../../../hooks/useHeavyAnimationCheck';

import GroupChatInfo from '../../common/GroupChatInfo';
import Button from '../../ui/Button';
import Topic from './Topic';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import HeaderActions from '../../middle/HeaderActions';
import GroupCallTopPane from '../../calls/group/GroupCallTopPane';
import EmptyForum from './EmptyForum';

import styles from './ForumPanel.module.scss';

type OwnProps = {
  isOpen?: boolean;
  isHidden?: boolean;
  onTopicSearch?: NoneToVoidFunction;
  onCloseAnimationEnd?: VoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  currentTopicId?: number;
  lastSyncTime?: number;
};

const INTERSECTION_THROTTLE = 200;

const ForumPanel: FC<OwnProps & StateProps> = ({
  chat,
  currentTopicId,
  isOpen,
  isHidden,
  lastSyncTime,
  onTopicSearch,
  onCloseAnimationEnd,
}) => {
  const {
    closeForumPanel, openChatWithInfo, loadTopics,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollTopHandlerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastSyncTime && chat && !chat.topics) {
      loadTopics({ chatId: chat.id });
    }
  }, [chat, lastSyncTime, loadTopics]);

  const [isScrolled, setIsScrolled] = useState(false);
  const lang = useLang();

  const handleClose = useCallback(() => {
    closeForumPanel();
  }, [closeForumPanel]);

  const handleToggleChatInfo = useCallback(() => {
    if (!chat) return;
    openChatWithInfo({ id: chat.id, shouldReplaceHistory: true });
  }, [chat, openChatWithInfo]);

  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  useOnIntersect(scrollTopHandlerRef, observe, ({ isIntersecting }) => {
    setIsScrolled(!isIntersecting);
  });

  const orderedIds = useMemo(() => {
    return chat?.topics
      ? getOrderedTopics(Object.values(chat.topics), chat.orderedPinnedTopicIds).map(({ id }) => id)
      : [];
  }, [chat]);

  const { orderDiffById, getAnimationType } = useChatOrderDiff(orderedIds);

  const [viewportIds, getMore] = useInfiniteScroll(() => {
    if (!chat || !lastSyncTime) return;
    loadTopics({ chatId: chat.id });
  }, orderedIds, !chat?.topicsCount || orderedIds.length >= chat.topicsCount, TOPICS_SLICE);

  const shouldRenderRef = useRef(false);
  const isVisible = isOpen && !isHidden;
  const prevIsVisible = usePrevious(isVisible);

  if (prevIsVisible !== isVisible) {
    shouldRenderRef.current = false;
  }

  useHistoryBack({
    isActive: isVisible,
    onBack: handleClose,
  });

  useEffect(() => (isVisible ? captureEscKeyListener(handleClose) : undefined), [handleClose, isVisible]);

  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();
      waitForTransitionEnd(ref.current!, () => {
        dispatchHeavyAnimationStop();
      });

      // For performance reasons, we delay animation of the topic list panel to the next animation frame
      fastRaf(() => {
        if (isVisible) {
          shouldRenderRef.current = true;
          ref.current!.style.transform = 'none';
        } else {
          shouldRenderRef.current = false;
          ref.current!.style.transform = '';
        }
      });
    }
  }, [isVisible, prevIsVisible]);

  function renderTopics() {
    const viewportOffset = orderedIds!.indexOf(viewportIds![0]);

    return viewportIds?.map((id, i) => (
      <Topic
        key={id}
        chatId={chat!.id}
        topic={chat!.topics![id]}
        style={`top: ${(viewportOffset + i) * TOPIC_HEIGHT_PX}px;`}
        isSelected={currentTopicId === id}
        observeIntersection={observe}
        animationType={getAnimationType(id)}
        orderDiff={orderDiffById[id]}
      />
    ));
  }

  const isLoading = chat?.topics === undefined;

  return (
    <div
      className={buildClassName(
        styles.root,
        isScrolled && styles.scrolled,
        lang.isRtl && styles.rtl,
      )}
      ref={ref}
      onTransitionEnd={!isOpen ? onCloseAnimationEnd : undefined}
    >
      <div className="left-header">
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleClose}
          ariaLabel={lang('Close')}
        >
          <i className="icon-close" />
        </Button>

        {chat && (
          <GroupChatInfo
            noAvatar
            className={styles.info}
            chatId={chat.id}
            onClick={handleToggleChatInfo}
          />
        )}

        {chat
          && (
            <HeaderActions
              chatId={chat.id}
              threadId={MAIN_THREAD_ID}
              messageListType="thread"
              canExpandActions={false}
              withForumActions
              onTopicSearch={onTopicSearch}
            />
          )}
      </div>

      {chat && <GroupCallTopPane chatId={chat.id} hasPinnedOffset={false} className={styles.groupCall} />}

      <div className={styles.borderBottom} />

      <InfiniteScroll
        className="chat-list custom-scroll"
        ref={containerRef}
        items={viewportIds}
        preloadBackwards={TOPICS_SLICE}
        withAbsolutePositioning
        maxHeight={(orderedIds?.length || 0) * TOPIC_HEIGHT_PX}
        onLoadMore={getMore}
        sensitiveArea={TOPIC_LIST_SENSITIVE_AREA}
        beforeChildren={<div ref={scrollTopHandlerRef} className={styles.scrollTopHandler} />}
      >
        {viewportIds?.length && (
          renderTopics()
        )}
        {isLoading && !viewportIds?.length && (
          <Loading key="loading" />
        )}
      </InfiniteScroll>
      {!isLoading && viewportIds?.length === 1 && viewportIds[0] === GENERAL_TOPIC_ID && (
        <EmptyForum chatId={chat.id} />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps, detachWhenChanged): StateProps => {
    const chatId = global.forumPanelChatId;
    detachWhenChanged(chatId);

    const chat = chatId ? selectChat(global, chatId) : undefined;
    const {
      chatId: currentChatId,
      threadId: currentThreadId,
    } = selectCurrentMessageList(global) || {};

    return {
      chat,
      lastSyncTime: global.lastSyncTime,
      currentTopicId: chatId === currentChatId ? currentThreadId : undefined,
    };
  },
)(ForumPanel));
