import {
  beginHeavyAnimation,
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChat } from '../../../../api/types';
import type { TopicsInfo } from '../../../../types';
import { MAIN_THREAD_ID } from '../../../../api/types';

import {
  GENERAL_TOPIC_ID, TOPIC_HEIGHT_PX, TOPIC_LIST_SENSITIVE_AREA, TOPICS_SLICE,
} from '../../../../config';
import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import { getOrderedTopics } from '../../../../global/helpers';
import {
  selectCanAnimateInterface,
  selectChat,
  selectCurrentMessageList,
  selectIsForumPanelOpen,
  selectTabState,
  selectTopicsInfo,
} from '../../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { captureEvents, SwipeDirection } from '../../../../util/captureEvents';
import { waitForTransitionEnd } from '../../../../util/cssAnimationEndListeners';
import { isUserId } from '../../../../util/entities/ids';

import useAppLayout from '../../../../hooks/useAppLayout';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useInfiniteScroll from '../../../../hooks/useInfiniteScroll';
import { useIntersectionObserver, useOnIntersect } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';
import useOrderDiff from '../hooks/useOrderDiff';

import GroupCallTopPane from '../../../calls/group/GroupCallTopPane';
import GroupChatInfo from '../../../common/GroupChatInfo';
import PrivateChatInfo from '../../../common/PrivateChatInfo';
import HeaderActions from '../../../middle/HeaderActions';
import Button from '../../../ui/Button';
import InfiniteScroll from '../../../ui/InfiniteScroll';
import Loading from '../../../ui/Loading';
import AllMessagesTopic from './AllMessagesTopic';
import EmptyForum from './EmptyForum';
import Topic from './Topic';

import styles from './ForumPanel.module.scss';

type OwnProps = {
  isOpen?: boolean;
  isHidden?: boolean;
  onTopicSearch?: NoneToVoidFunction;
  onCloseAnimationEnd?: VoidFunction;
  onOpenAnimationStart?: VoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  topicsInfo?: TopicsInfo;
  currentTopicId?: number;
  withInterfaceAnimations?: boolean;
};

const INTERSECTION_THROTTLE = 200;

const ForumPanel = ({
  chat,
  currentTopicId,
  isOpen,
  isHidden,
  topicsInfo,
  withInterfaceAnimations,
  onTopicSearch,
  onCloseAnimationEnd,
  onOpenAnimationStart,
}: OwnProps & StateProps) => {
  const {
    closeForumPanel, openChatWithInfo, loadTopics,
  } = getActions();

  const ref = useRef<HTMLDivElement>();

  const containerRef = useRef<HTMLDivElement>();
  const scrollTopHandlerRef = useRef<HTMLDivElement>();
  const { isMobile } = useAppLayout();
  const chatId = chat?.id;

  useEffect(() => {
    if (chatId && !topicsInfo) {
      loadTopics({ chatId });
    }
  }, [topicsInfo, chatId]);

  const [isScrolled, setIsScrolled] = useState(false);
  const lang = useLang();

  const handleClose = useLastCallback(() => {
    closeForumPanel();
  });

  useEffect(() => {
    if (!withInterfaceAnimations && !isOpen) {
      onCloseAnimationEnd?.();
    }
  }, [withInterfaceAnimations, isOpen, onCloseAnimationEnd]);

  const handleToggleChatInfo = useLastCallback(() => {
    if (!chat) return;
    openChatWithInfo({ id: chat.id, shouldReplaceHistory: true });
  });

  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  useOnIntersect(scrollTopHandlerRef, observe, ({ isIntersecting }) => {
    setIsScrolled(!isIntersecting);
  });

  const orderedIds = useMemo(() => {
    const ids = topicsInfo
      ? getOrderedTopics(
        Object.values(topicsInfo.topicsById),
        topicsInfo.orderedPinnedTopicIds,
      ).map(({ id }) => id)
      : [];

    if (!chat?.isBotForum) return ids;

    return [MAIN_THREAD_ID, ...ids];
  }, [chat?.isBotForum, topicsInfo]);

  const { orderDiffById, shiftDiff, getAnimationType, onReorderAnimationEnd } = useOrderDiff(orderedIds, 0, chat?.id);

  const [viewportIds, getMore] = useInfiniteScroll(() => {
    if (!chat) return;
    loadTopics({ chatId: chat.id });
  }, orderedIds, !topicsInfo?.totalCount || orderedIds.length >= topicsInfo.totalCount, TOPICS_SLICE);

  const shouldRenderRef = useRef(false);
  const isVisible = isOpen && !isHidden;
  const prevIsVisible = usePreviousDeprecated(isVisible);

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
      // For performance reasons, we delay animation of the topic list panel to the next animation frame
      requestNextMutation(() => {
        if (!ref.current) return;

        const endHeavyAnimation = beginHeavyAnimation();
        waitForTransitionEnd(ref.current, endHeavyAnimation);

        onOpenAnimationStart?.();

        if (isVisible) {
          shouldRenderRef.current = true;
          ref.current.style.transform = 'none';
        } else {
          shouldRenderRef.current = false;
          ref.current.style.transform = '';
        }
      });
    }
  }, [isVisible, onOpenAnimationStart, prevIsVisible]);

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      return undefined;
    }

    return captureEvents(ref.current!, {
      selectorToPreventScroll: '.chat-list',
      onSwipe: (e, direction) => {
        const closeDirection = lang.isRtl ? SwipeDirection.Left : SwipeDirection.Right;

        if (direction === closeDirection) {
          closeForumPanel();
          return true;
        }

        return false;
      },
    });
  }, [closeForumPanel, lang.isRtl]);

  function renderTopics() {
    const viewportOffset = orderedIds.indexOf(viewportIds![0]);

    return viewportIds?.map((id, i) => {
      if (id === MAIN_THREAD_ID) {
        return (
          <AllMessagesTopic
            key={id}
            chatId={chat!.id}
            isSelected={currentTopicId === id}
          />
        );
      }

      return (
        <Topic
          key={id}
          chatId={chat!.id}
          topic={topicsInfo!.topicsById[id]}
          style={`top: ${(viewportOffset + i) * TOPIC_HEIGHT_PX}px;`}
          isSelected={currentTopicId === id}
          observeIntersection={observe}
          animationType={getAnimationType(id)}
          orderDiff={orderDiffById[id]}
          shiftDiff={shiftDiff}
          onReorderAnimationEnd={onReorderAnimationEnd}
        />
      );
    });
  }

  const isLoading = topicsInfo === undefined;

  if (!chat) return undefined;

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        isScrolled && styles.scrolled,
        lang.isRtl && styles.rtl,
        !withInterfaceAnimations && styles.noAnimation,
      )}
      onTransitionEnd={!isOpen ? onCloseAnimationEnd : undefined}
    >
      <div id="TopicListHeader" className="left-header">
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleClose}
          ariaLabel={lang('Close')}
          iconName="close"
        />

        {isUserId(chat.id) ? (
          <PrivateChatInfo
            noAvatar
            className={styles.info}
            userId={chat.id}
            onClick={handleToggleChatInfo}
          />
        ) : (
          <GroupChatInfo
            noAvatar
            className={styles.info}
            chatId={chat.id}
            onClick={handleToggleChatInfo}
          />
        )}

        <HeaderActions
          chatId={chat.id}
          threadId={MAIN_THREAD_ID}
          messageListType="thread"
          canExpandActions={false}
          isForForum
          isMobile={isMobile}
          onTopicSearch={onTopicSearch}
        />
      </div>

      {!isUserId(chat.id) && <GroupCallTopPane chatId={chat.id} />}

      <div className={styles.notch} />

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
        {Boolean(viewportIds?.length) && (
          renderTopics()
        )}
        {isLoading && !viewportIds?.length && (
          <Loading key="loading" />
        )}
      </InfiniteScroll>
      {!isLoading && viewportIds?.length === 1 && viewportIds[0] === GENERAL_TOPIC_ID && (
        <EmptyForum chatId={chatId!} />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const chatId = selectTabState(global).forumPanelChatId;
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const {
      chatId: currentChatId,
      threadId: currentThreadId,
    } = selectCurrentMessageList(global) || {};
    const topicsInfo = chatId ? selectTopicsInfo(global, chatId) : undefined;

    return {
      chat,
      currentTopicId: chatId === currentChatId ? Number(currentThreadId) : undefined,
      withInterfaceAnimations: selectCanAnimateInterface(global),
      topicsInfo,
    };
  },
  (global) => selectIsForumPanelOpen(global),
)(ForumPanel));
