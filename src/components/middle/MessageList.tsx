import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
} from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiMessage, ApiRestrictionReason, ApiTopic,
} from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { Signal } from '../../util/signals';
import type { PinnedIntersectionChangedCallback } from './hooks/usePinnedMessage';
import { MAIN_THREAD_ID } from '../../api/types';
import { LoadMoreDirection } from '../../types';

import {
  ANIMATION_END_DELAY,
  MESSAGE_LIST_SLICE,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { forceMeasure, requestForcedReflow, requestMeasure } from '../../lib/fasterdom/fasterdom';
import {
  getMessageHtmlId,
  isChatChannel,
  isChatGroup,
  isChatSuperGroup,
  isChatWithRepliesBot,
  isLocalMessageId,
  isMainThread,
  isReplyMessage,
  isUserId,
} from '../../global/helpers';
import {
  selectBot,
  selectChat,
  selectChatFullInfo,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentMessageIds,
  selectFirstUnreadId,
  selectFocusedMessageId,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectIsInSelectMode,
  selectIsViewportNewest,
  selectLastScrollOffset,
  selectPerformanceSettingsValue,
  selectScrollOffset,
  selectTabState,
  selectThreadInfo,
  selectThreadTopMessageId,
} from '../../global/selectors';
import animateScroll, { isAnimatingScroll, restartCurrentScrollAnimation } from '../../util/animateScroll';
import buildClassName from '../../util/buildClassName';
import { orderBy } from '../../util/iteratees';
import resetScroll from '../../util/resetScroll';
import { debounce, onTickEnd } from '../../util/schedulers';
import { groupMessages } from './helpers/groupMessages';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

import { isBackgroundModeActive } from '../../hooks/useBackgroundMode';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useInterval from '../../hooks/useInterval';
import useLastCallback from '../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useNativeCopySelectedMessages from '../../hooks/useNativeCopySelectedMessages';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import useContainerHeight from './hooks/useContainerHeight';
import useStickyDates from './hooks/useStickyDates';

import Loading from '../ui/Loading';
import ContactGreeting from './ContactGreeting';
import MessageListBotInfo from './MessageListBotInfo';
import MessageListContent from './MessageListContent';
import NoMessages from './NoMessages';

import './MessageList.scss';

type OwnProps = {
  chatId: string;
  threadId: number;
  type: MessageListType;
  canPost: boolean;
  isReady: boolean;
  onFabToggle: (shouldShow: boolean) => void;
  onNotchToggle: (shouldShow: boolean) => void;
  hasTools?: boolean;
  withBottomShift?: boolean;
  withDefaultBg: boolean;
  onPinnedIntersectionChange: PinnedIntersectionChangedCallback;
  getForceNextPinnedInHeader: Signal<boolean | undefined>;
};

type StateProps = {
  isCurrentUserPremium?: boolean;
  isChatLoaded?: boolean;
  isChannelChat?: boolean;
  isGroupChat?: boolean;
  isSuperGroupChat?: boolean;
  isChatWithSelf?: boolean;
  isRepliesChat?: boolean;
  isCreator?: boolean;
  isBot?: boolean;
  messageIds?: number[];
  messagesById?: Record<number, ApiMessage>;
  firstUnreadId?: number;
  isComments?: boolean;
  isViewportNewest?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
  focusingId?: number;
  isSelectModeActive?: boolean;
  lastMessage?: ApiMessage;
  threadTopMessageId?: number;
  hasLinkedChat?: boolean;
  topic?: ApiTopic;
  noMessageSendingAnimation?: boolean;
  isServiceNotificationsChat?: boolean;
};

const MESSAGE_REACTIONS_POLLING_INTERVAL = 15 * 1000;
const MESSAGE_COMMENTS_POLLING_INTERVAL = 15 * 1000;
const MESSAGE_STORY_POLLING_INTERVAL = 5 * 60 * 1000;
const BOTTOM_THRESHOLD = 50;
const UNREAD_DIVIDER_TOP = 10;
const UNREAD_DIVIDER_TOP_WITH_TOOLS = 60;
const SCROLL_DEBOUNCE = 200;
const MESSAGE_ANIMATION_DURATION = 500;
const BOTTOM_FOCUS_MARGIN = 20;
const SELECT_MODE_ANIMATION_DURATION = 200;
const UNREAD_DIVIDER_CLASS = 'unread-divider';
const QUOTE_APP_WITH_REPLIES_IN_MAIN_THREAD = false; // TODO move somewhere else

const runDebouncedForScroll = debounce((cb) => cb(), SCROLL_DEBOUNCE, false);

const MessageList: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  type,
  hasTools,
  onFabToggle,
  onNotchToggle,
  isCurrentUserPremium,
  isChatLoaded,
  isChannelChat,
  isGroupChat,
  isSuperGroupChat,
  canPost,
  isReady,
  isChatWithSelf,
  isRepliesChat,
  isCreator,
  isBot,
  messageIds,
  messagesById,
  firstUnreadId,
  isComments,
  isViewportNewest,
  isRestricted,
  restrictionReason,
  focusingId,
  isSelectModeActive,
  lastMessage,
  threadTopMessageId,
  hasLinkedChat,
  withBottomShift,
  withDefaultBg,
  topic,
  noMessageSendingAnimation,
  isServiceNotificationsChat,
  onPinnedIntersectionChange,
  getForceNextPinnedInHeader,
}) => {
  const {
    loadViewportMessages, setScrollOffset, loadSponsoredMessages, loadMessageReactions, copyMessagesByIds,
    loadMessageViews, loadPeerStoriesByIds,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  // We update local cached `scrollOffsetRef` when opening chat.
  // Then we update global version every second on scrolling.
  const scrollOffsetRef = useRef<number>(
    (type === 'thread' && selectScrollOffset(getGlobal(), chatId, threadId))
    || selectLastScrollOffset(getGlobal(), chatId, threadId)
    || 0,
  );

  const anchorIdRef = useRef<string>();
  const anchorTopRef = useRef<number>();
  const listItemElementsRef = useRef<HTMLDivElement[]>();
  const memoFirstUnreadIdRef = useRef<number>();
  const memoUnreadDividerBeforeIdRef = useRef<number | undefined>();
  const memoFocusingIdRef = useRef<number>();
  const isScrollTopJustUpdatedRef = useRef(false);
  const shouldAnimateAppearanceRef = useRef(Boolean(lastMessage));

  const withReplies = isMainThread(threadId) && isSuperGroupChat ? QUOTE_APP_WITH_REPLIES_IN_MAIN_THREAD : true; // TODO other group types

  const areMessagesLoaded = Boolean(messageIds);

  useSyncEffect(() => {
    // We only need it first time when message list appears
    if (areMessagesLoaded) {
      onTickEnd(() => {
        shouldAnimateAppearanceRef.current = false;
      });
    }
  }, [areMessagesLoaded]);

  // Updated every time (to be used from intersection callback closure)
  useSyncEffect(() => {
    memoFirstUnreadIdRef.current = firstUnreadId;
  }, [firstUnreadId]);

  useEffect(() => {
    if (!isCurrentUserPremium && isChannelChat && isReady) {
      loadSponsoredMessages({ chatId });
    }
  }, [isCurrentUserPremium, chatId, isReady, isChannelChat]);

  // Updated only once when messages are loaded (as we want the unread divider to keep its position)
  useSyncEffect(() => {
    if (areMessagesLoaded) {
      memoUnreadDividerBeforeIdRef.current = memoFirstUnreadIdRef.current;
    }
  }, [areMessagesLoaded]);

  useSyncEffect(() => {
    memoFocusingIdRef.current = focusingId;
  }, [focusingId]);

  useNativeCopySelectedMessages(copyMessagesByIds);

  const messagesByIdFiltered = useMemo(
    () => (messagesById
      ? Object.values(messagesById).reduce((acc, message) => {
        if (!withReplies && isReplyMessage(message)) return acc;

        acc[message.id] = message;
        return acc;
      }, {} as Record<number, ApiMessage>)
      : {} as Record<number, ApiMessage>),
    [messagesById, withReplies],
  );

  const messageGroups = useMemo(() => {
    if (!messageIds?.length || !messagesByIdFiltered) {
      return undefined;
    }

    const listedMessages = messageIds.map((id) => messagesByIdFiltered[id]).filter(Boolean);

    // Service notifications have local IDs which may be not in sync with real message history
    const orderRule: (keyof ApiMessage)[] = type === 'scheduled' || isServiceNotificationsChat
      ? ['date', 'id']
      : ['id'];

    return listedMessages.length
      ? groupMessages(orderBy(listedMessages, orderRule), memoUnreadDividerBeforeIdRef.current)
      : undefined;
  }, [messageIds, messagesByIdFiltered, type, isServiceNotificationsChat]);

  useInterval(() => {
    if (!messageIds || !messagesByIdFiltered || type === 'scheduled') {
      return;
    }
    const ids = messageIds.filter((id) => messagesByIdFiltered[id]?.reactions);

    if (!ids.length) return;

    loadMessageReactions({ chatId, ids });
  }, MESSAGE_REACTIONS_POLLING_INTERVAL);

  useInterval(() => {
    if (!messageIds || !messagesByIdFiltered || type === 'scheduled') {
      return;
    }
    const storyDataList = messageIds.map((id) => messagesByIdFiltered[id]?.content.storyData).filter(Boolean);

    if (!storyDataList.length) return;

    const storiesByPeerIds = storyDataList.reduce((acc, storyData) => {
      const { peerId, id } = storyData!;
      if (!acc[peerId]) {
        acc[peerId] = [];
      }
      acc[peerId].push(id);
      return acc;
    }, {} as Record<string, number[]>);

    Object.entries(storiesByPeerIds).forEach(([peerId, storyIds]) => {
      loadPeerStoriesByIds({ peerId, storyIds });
    });
  }, MESSAGE_STORY_POLLING_INTERVAL);

  useInterval(() => {
    if (!messageIds || !messagesById || threadId !== MAIN_THREAD_ID || type === 'scheduled') {
      return;
    }
    const ids = messageIds.filter((id) => messagesById[id]?.repliesThreadInfo?.isComments
      || messagesById[id]?.views !== undefined);

    if (!ids.length) return;

    loadMessageViews({ chatId, ids });
  }, MESSAGE_COMMENTS_POLLING_INTERVAL);

  const loadMoreAround = useMemo(() => {
    if (type !== 'thread') {
      return undefined;
    }

    return debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Around }), 1000, true, false);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [loadViewportMessages, messageIds]);

  const { isScrolled, updateStickyDates } = useStickyDates();

  const handleScroll = useLastCallback(() => {
    if (isScrollTopJustUpdatedRef.current) {
      isScrollTopJustUpdatedRef.current = false;
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!memoFocusingIdRef.current) {
      updateStickyDates(container, hasTools);
    }

    runDebouncedForScroll(() => {
      const global = getGlobal();
      const forceNextPinnedInHeader = getForceNextPinnedInHeader() && !selectTabState(global).focusedMessage?.chatId;
      if (forceNextPinnedInHeader) {
        onPinnedIntersectionChange({ hasScrolled: true });
      }

      if (!container.parentElement) {
        return;
      }

      scrollOffsetRef.current = container.scrollHeight - container.scrollTop;

      if (type === 'thread') {
        setScrollOffset({ chatId, threadId, scrollOffset: scrollOffsetRef.current });
      }
    });
  });

  const [getContainerHeight, prevContainerHeightRef] = useContainerHeight(containerRef, canPost && !isSelectModeActive);

  // Initial message loading
  useEffect(() => {
    if (!loadMoreAround || !isChatLoaded || isRestricted || focusingId) {
      return;
    }

    // Loading history while sending a message can return the same message and cause ambiguity
    const isLastMessageLocal = messageIds && isLocalMessageId(messageIds[messageIds.length - 1]);
    if (isLastMessageLocal) {
      return;
    }

    const container = containerRef.current!;

    if (!messageIds || (
      messageIds.length < MESSAGE_LIST_SLICE / 2
      && (container.firstElementChild as HTMLDivElement).clientHeight <= container.offsetHeight
    )) {
      loadMoreAround();
    }
  }, [isChatLoaded, messageIds, loadMoreAround, focusingId, isRestricted]);

  const rememberScrollPositionRef = useStateRef(() => {
    if (!messageIds || !listItemElementsRef.current) {
      return;
    }

    const preservedItemElements = listItemElementsRef.current
      .filter((element) => messageIds.includes(Number(element.dataset.messageId)));

    // We avoid the very first item as it may be a partly-loaded album
    // and also because it may be removed when messages limit is reached
    const anchor = preservedItemElements[1] || preservedItemElements[0];
    if (!anchor) {
      return;
    }

    anchorIdRef.current = anchor.id;
    anchorTopRef.current = anchor.getBoundingClientRect().top;
  });

  useSyncEffect(
    () => forceMeasure(() => rememberScrollPositionRef.current()),
    // This will run before modifying content and should match deps for `useLayoutEffectWithPrevDeps` below
    [messageIds, isViewportNewest, hasTools, rememberScrollPositionRef],
  );
  useEffect(
    () => rememberScrollPositionRef.current(),
    // This is only needed to react on signal updates
    [getContainerHeight, rememberScrollPositionRef],
  );

  // Handles updated message list, takes care of scroll repositioning
  useLayoutEffectWithPrevDeps(([prevMessageIds, prevIsViewportNewest]) => {
    if (process.env.APP_ENV === 'perf') {
      // eslint-disable-next-line no-console
      console.time('scrollTop');
    }

    const containerHeight = getContainerHeight();
    const prevContainerHeight = prevContainerHeightRef.current;
    prevContainerHeightRef.current = containerHeight;

    // Skip initial resize observer callback
    if (
      messageIds === prevMessageIds
      && isViewportNewest === prevIsViewportNewest
      && containerHeight !== prevContainerHeight
      && prevContainerHeight === undefined
    ) {
      return;
    }

    const container = containerRef.current!;
    listItemElementsRef.current = Array.from(container.querySelectorAll<HTMLDivElement>('.message-list-item'));
    const lastItemElement = listItemElementsRef.current[listItemElementsRef.current.length - 1];
    const firstUnreadElement = memoFirstUnreadIdRef.current
      ? container.querySelector<HTMLDivElement>(`#${getMessageHtmlId(memoFirstUnreadIdRef.current)}`)
      : undefined;

    const hasLastMessageChanged = (
      messageIds && prevMessageIds && messageIds[messageIds.length - 1] !== prevMessageIds[prevMessageIds.length - 1]
    );
    const hasViewportShifted = (
      messageIds?.[0] !== prevMessageIds?.[0] && messageIds?.length === (MESSAGE_LIST_SLICE / 2 + 1)
    );
    const wasMessageAdded = hasLastMessageChanged && !hasViewportShifted;

    // Add extra height when few messages to allow scroll animation
    if (
      isViewportNewest
      && wasMessageAdded
      && (messageIds && messageIds.length < MESSAGE_LIST_SLICE / 2)
      && !container.parentElement!.classList.contains('force-messages-scroll')
      && forceMeasure(() => (
        (container.firstElementChild as HTMLDivElement)!.clientHeight <= container.offsetHeight * 2
      ))
    ) {
      addExtraClass(container.parentElement!, 'force-messages-scroll');
      container.parentElement!.classList.add('force-messages-scroll');

      setTimeout(() => {
        if (container.parentElement) {
          removeExtraClass(container.parentElement!, 'force-messages-scroll');
        }
      }, MESSAGE_ANIMATION_DURATION);
    }

    requestForcedReflow(() => {
      const { scrollTop, scrollHeight, offsetHeight } = container;
      const scrollOffset = scrollOffsetRef.current;

      let bottomOffset = scrollOffset - (prevContainerHeight || offsetHeight);
      if (wasMessageAdded) {
        // If two new messages come at once (e.g. when bot responds) then the first message will update `scrollOffset`
        // right away (before animation) which creates inconsistency until the animation completes. To work around that,
        // we calculate `isAtBottom` with a "buffer" of the latest message height (this is approximate).
        const lastItemHeight = lastItemElement ? lastItemElement.offsetHeight : 0;
        bottomOffset -= lastItemHeight;
      }
      const isAtBottom = isViewportNewest && prevIsViewportNewest && bottomOffset <= BOTTOM_THRESHOLD;
      const isAlreadyFocusing = messageIds && memoFocusingIdRef.current === messageIds[messageIds.length - 1];

      // Animate incoming message, but if app is in background mode, scroll to the first unread
      if (wasMessageAdded && isAtBottom && !isAlreadyFocusing) {
        // Break out of `forceLayout`
        requestMeasure(() => {
          const shouldScrollToBottom = !isBackgroundModeActive() || !firstUnreadElement;

          animateScroll(
            container,
            shouldScrollToBottom ? lastItemElement! : firstUnreadElement!,
            shouldScrollToBottom ? 'end' : 'start',
            BOTTOM_FOCUS_MARGIN,
            undefined,
            undefined,
            noMessageSendingAnimation ? 0 : undefined,
          );
        });
      }

      const isResized = prevContainerHeight !== undefined && prevContainerHeight !== containerHeight;
      if (isResized && isAnimatingScroll()) {
        return undefined;
      }

      const anchor = anchorIdRef.current && container.querySelector(`#${anchorIdRef.current}`);
      const unreadDivider = (
        !anchor
        && memoUnreadDividerBeforeIdRef.current
        && container.querySelector<HTMLDivElement>(`.${UNREAD_DIVIDER_CLASS}`)
      );

      let newScrollTop!: number;
      if (isAtBottom && isResized) {
        newScrollTop = scrollHeight - offsetHeight;
      } else if (anchor) {
        const newAnchorTop = anchor.getBoundingClientRect().top;
        newScrollTop = scrollTop + (newAnchorTop - (anchorTopRef.current || 0));
      } else if (unreadDivider) {
        newScrollTop = Math.min(
          unreadDivider.offsetTop - (hasTools ? UNREAD_DIVIDER_TOP_WITH_TOOLS : UNREAD_DIVIDER_TOP),
          scrollHeight - scrollOffset,
        );
      } else {
        newScrollTop = scrollHeight - scrollOffset;
      }

      return () => {
        resetScroll(container, Math.ceil(newScrollTop));
        restartCurrentScrollAnimation();

        scrollOffsetRef.current = Math.max(Math.ceil(scrollHeight - newScrollTop), offsetHeight);

        if (!memoFocusingIdRef.current) {
          isScrollTopJustUpdatedRef.current = true;

          requestMeasure(() => {
            isScrollTopJustUpdatedRef.current = false;
          });
        }

        if (process.env.APP_ENV === 'perf') {
          // eslint-disable-next-line no-console
          console.timeEnd('scrollTop');
        }
      };
    });
    // This should match deps for `useSyncEffect` above
  }, [messageIds, isViewportNewest, hasTools, getContainerHeight, prevContainerHeightRef, noMessageSendingAnimation]);

  useEffectWithPrevDeps(([prevIsSelectModeActive]) => {
    if (prevIsSelectModeActive !== undefined) {
      dispatchHeavyAnimationEvent(SELECT_MODE_ANIMATION_DURATION + ANIMATION_END_DELAY);
    }
  }, [isSelectModeActive]);

  const isPrivate = Boolean(chatId && isUserId(chatId));
  const withUsers = Boolean((!isPrivate && !isChannelChat) || isChatWithSelf || isRepliesChat);
  const noAvatars = Boolean(!withUsers || isChannelChat);
  const shouldRenderGreeting = isUserId(chatId) && !isChatWithSelf && !isBot
    && (
      (
        !messageGroups && !lastMessage && messageIds
        // Used to avoid flickering when deleting a greeting that has just been sent
        && (!listItemElementsRef.current || listItemElementsRef.current.length === 0)
      )
      || (messageIds?.length === 1 && messagesById?.[messageIds[0]]?.content.action?.type === 'contactSignUp')
      || (lastMessage?.content?.action?.type === 'contactSignUp')
    );

  const isGroupChatJustCreated = isGroupChat && isCreator
    && messageIds?.length === 1 && messagesById?.[messageIds[0]]?.content.action?.type === 'chatCreate';
  const isEmptyTopic = messageIds?.length === 1
    && messagesById?.[messageIds[0]]?.content.action?.type === 'topicCreate';

  const className = buildClassName(
    'MessageList custom-scroll',
    noAvatars && 'no-avatars',
    !canPost && 'no-composer',
    type === 'pinned' && 'type-pinned',
    withBottomShift && 'with-bottom-shift',
    withDefaultBg && 'with-default-bg',
    isSelectModeActive && 'select-mode-active',
    isScrolled && 'scrolled',
    !isReady && 'is-animating',
  );

  const hasMessages = (messageIds && messageGroups) || lastMessage;

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      onMouseDown={preventMessageInputBlur}
    >
      {isRestricted ? (
        <div className="empty">
          <span>
            {restrictionReason ? restrictionReason.text : `This is a private ${isChannelChat ? 'channel' : 'chat'}`}
          </span>
        </div>
      ) : isBot && !hasMessages ? (
        <MessageListBotInfo chatId={chatId} />
      ) : shouldRenderGreeting ? (
        <ContactGreeting userId={chatId} />
      ) : messageIds && (!messageGroups || isGroupChatJustCreated || isEmptyTopic) ? (
        <NoMessages
          chatId={chatId}
          topic={topic}
          type={type}
          isChatWithSelf={isChatWithSelf}
          isGroupChatJustCreated={isGroupChatJustCreated}
        />
      ) : hasMessages ? (
        <MessageListContent
          isCurrentUserPremium={isCurrentUserPremium}
          chatId={chatId}
          isComments={isComments}
          isChannelChat={isChannelChat}
          messageIds={messageIds || [lastMessage!.id]}
          messageGroups={messageGroups || groupMessages([lastMessage!])}
          getContainerHeight={getContainerHeight}
          isViewportNewest={Boolean(isViewportNewest)}
          isUnread={Boolean(firstUnreadId)}
          withUsers={withUsers}
          noAvatars={noAvatars}
          containerRef={containerRef}
          anchorIdRef={anchorIdRef}
          memoUnreadDividerBeforeIdRef={memoUnreadDividerBeforeIdRef}
          memoFirstUnreadIdRef={memoFirstUnreadIdRef}
          threadId={threadId}
          type={type}
          isReady={isReady}
          threadTopMessageId={threadTopMessageId}
          hasLinkedChat={hasLinkedChat}
          isSchedule={messageGroups ? type === 'scheduled' : false}
          shouldRenderBotInfo={isBot}
          noAppearanceAnimation={!messageGroups || !shouldAnimateAppearanceRef.current}
          onFabToggle={onFabToggle}
          onNotchToggle={onNotchToggle}
          onPinnedIntersectionChange={onPinnedIntersectionChange}
        />
      ) : (
        <Loading color="white" backgroundColor="dark" />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId, type }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return {};
    }

    const messageIds = selectCurrentMessageIds(global, chatId, threadId, type);
    const messagesById = type === 'scheduled'
      ? selectChatScheduledMessages(global, chatId)
      : selectChatMessages(global, chatId);
    const threadTopMessageId = selectThreadTopMessageId(global, chatId, threadId);
    const threadInfo = selectThreadInfo(global, chatId, threadId);

    if (
      threadId !== MAIN_THREAD_ID && !chat?.isForum
      && !(messagesById && threadTopMessageId && messagesById[threadTopMessageId])
    ) {
      return {};
    }

    const { isRestricted, restrictionReason, lastMessage } = chat;
    const focusingId = selectFocusedMessageId(global, chatId);

    const withLastMessageWhenPreloading = (
      threadId === MAIN_THREAD_ID
      && !messageIds && !chat.unreadCount && !focusingId && lastMessage && !lastMessage.groupedId
    );

    const chatBot = selectBot(global, chatId);

    const topic = chat.topics?.[threadId];
    const chatFullInfo = !isUserId(chatId) ? selectChatFullInfo(global, chatId) : undefined;

    return {
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isChatLoaded: true,
      isRestricted,
      restrictionReason,
      isChannelChat: isChatChannel(chat),
      isGroupChat: isChatGroup(chat),
      isSuperGroupChat: isChatSuperGroup(chat),
      isCreator: chat.isCreator,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      isRepliesChat: isChatWithRepliesBot(chatId),
      isBot: Boolean(chatBot),
      messageIds,
      messagesById,
      isComments: Boolean(threadInfo?.originChannelId),
      firstUnreadId: selectFirstUnreadId(global, chatId, threadId),
      isViewportNewest: type !== 'thread' || selectIsViewportNewest(global, chatId, threadId),
      focusingId,
      isSelectModeActive: selectIsInSelectMode(global),
      threadTopMessageId,
      hasLinkedChat: chatFullInfo ? Boolean(chatFullInfo.linkedChatId) : undefined,
      topic,
      noMessageSendingAnimation: !selectPerformanceSettingsValue(global, 'messageSendingAnimations'),
      isServiceNotificationsChat: chatId === SERVICE_NOTIFICATIONS_USER_ID,
      ...(withLastMessageWhenPreloading && { lastMessage }),
    };
  },
)(MessageList));
