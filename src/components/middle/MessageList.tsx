import type { FC } from '../../lib/teact/teact';
import React, {
  beginHeavyAnimation, memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiChatFullInfo, ApiMessage, ApiRestrictionReason, ApiTopic,
} from '../../api/types';
import type { OnIntersectPinnedMessage } from './hooks/usePinnedMessage';
import { MAIN_THREAD_ID } from '../../api/types';
import { LoadMoreDirection, type MessageListType, type ThreadId } from '../../types';

import {
  ANIMATION_END_DELAY,
  ANONYMOUS_USER_ID,
  MESSAGE_LIST_SLICE,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { forceMeasure, requestForcedReflow, requestMeasure } from '../../lib/fasterdom/fasterdom';
import {
  getIsSavedDialog,
  getMessageHtmlId,
  isAnonymousForwardsChat,
  isChatChannel,
  isChatGroup,
  isSystemBot,
  isUserId,
} from '../../global/helpers';
import {
  selectBot,
  selectChat,
  selectChatFullInfo,
  selectChatLastMessage,
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
  selectTopic,
  selectUserFullInfo,
} from '../../global/selectors';
import animateScroll, { isAnimatingScroll, restartCurrentScrollAnimation } from '../../util/animateScroll';
import buildClassName from '../../util/buildClassName';
import { orderBy } from '../../util/iteratees';
import { isLocalMessageId } from '../../util/keys/messageKey';
import resetScroll from '../../util/resetScroll';
import { debounce, onTickEnd } from '../../util/schedulers';
import getOffsetToContainer from '../../util/visibility/getOffsetToContainer';
import { groupMessages } from './helpers/groupMessages';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

import useInterval from '../../hooks/schedulers/useInterval';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useNativeCopySelectedMessages from '../../hooks/useNativeCopySelectedMessages';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import { isBackgroundModeActive } from '../../hooks/window/useBackgroundMode';
import useContainerHeight from './hooks/useContainerHeight';
import useStickyDates from './hooks/useStickyDates';

import Loading from '../ui/Loading';
import ContactGreeting from './ContactGreeting';
import MessageListBotInfo from './MessageListBotInfo';
import MessageListContent from './MessageListContent';
import NoMessages from './NoMessages';
import PremiumRequiredMessage from './PremiumRequiredMessage';

import './MessageList.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  type: MessageListType;
  isComments?: boolean;
  canPost: boolean;
  isReady: boolean;
  onScrollDownToggle: BooleanToVoidFunction;
  onNotchToggle: BooleanToVoidFunction;
  withBottomShift?: boolean;
  withDefaultBg: boolean;
  onIntersectPinnedMessage: OnIntersectPinnedMessage;
  isContactRequirePremium?: boolean;
};

type StateProps = {
  isChatLoaded?: boolean;
  isChannelChat?: boolean;
  isGroupChat?: boolean;
  isChatWithSelf?: boolean;
  isSystemBotChat?: boolean;
  isAnonymousForwards?: boolean;
  isCreator?: boolean;
  isChannelWithAvatars?: boolean;
  isBot?: boolean;
  isSynced?: boolean;
  messageIds?: number[];
  messagesById?: Record<number, ApiMessage>;
  firstUnreadId?: number;
  isViewportNewest?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
  focusingId?: number;
  isSelectModeActive?: boolean;
  lastMessage?: ApiMessage;
  hasLinkedChat?: boolean;
  topic?: ApiTopic;
  noMessageSendingAnimation?: boolean;
  isServiceNotificationsChat?: boolean;
  isEmptyThread?: boolean;
  isForum?: boolean;
  currentUserId: string;
  areAdsEnabled?: boolean;
  channelJoinInfo?: ApiChatFullInfo['joinInfo'];
};

const MESSAGE_REACTIONS_POLLING_INTERVAL = 20 * 1000;
const MESSAGE_COMMENTS_POLLING_INTERVAL = 20 * 1000;
const MESSAGE_FACT_CHECK_UPDATE_INTERVAL = 5 * 1000;
const MESSAGE_STORY_POLLING_INTERVAL = 5 * 60 * 1000;
const BOTTOM_THRESHOLD = 50;
const UNREAD_DIVIDER_TOP = 10;
const SCROLL_DEBOUNCE = 200;
const MESSAGE_ANIMATION_DURATION = 500;
const BOTTOM_FOCUS_MARGIN = 20;
const SELECT_MODE_ANIMATION_DURATION = 200;
const UNREAD_DIVIDER_CLASS = 'unread-divider';

const runDebouncedForScroll = debounce((cb) => cb(), SCROLL_DEBOUNCE, false);

const MessageList: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  type,
  isChatLoaded,
  isForum,
  isChannelChat,
  isGroupChat,
  isChannelWithAvatars,
  canPost,
  isSynced,
  isReady,
  isChatWithSelf,
  isSystemBotChat,
  isAnonymousForwards,
  isCreator,
  isBot,
  messageIds,
  messagesById,
  firstUnreadId,
  isComments,
  isViewportNewest,
  isRestricted,
  restrictionReason,
  isEmptyThread,
  focusingId,
  isSelectModeActive,
  lastMessage,
  hasLinkedChat,
  withBottomShift,
  withDefaultBg,
  topic,
  noMessageSendingAnimation,
  isServiceNotificationsChat,
  currentUserId,
  isContactRequirePremium,
  areAdsEnabled,
  channelJoinInfo,
  onIntersectPinnedMessage,
  onScrollDownToggle,
  onNotchToggle,
}) => {
  const {
    loadViewportMessages, setScrollOffset, loadSponsoredMessages, loadMessageReactions, copyMessagesByIds,
    loadMessageViews, loadPeerStoriesByIds, loadFactChecks,
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

  const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);
  const hasOpenChatButton = isSavedDialog && threadId !== ANONYMOUS_USER_ID;

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
    const canHaveAds = isChannelChat || isBot;
    if (areAdsEnabled && canHaveAds && isSynced && isReady) {
      loadSponsoredMessages({ peerId: chatId });
    }
  }, [chatId, isSynced, isReady, isChannelChat, isBot, areAdsEnabled]);

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

  const messageGroups = useMemo(() => {
    if (!messageIds?.length || !messagesById) {
      return undefined;
    }

    const listedMessages: ApiMessage[] = [];
    messageIds.forEach((id, index, arr) => {
      const prevMessage = listedMessages[listedMessages.length - 1];

      const message = messagesById[id];
      if (!message) {
        return;
      }

      const { shouldAppendJoinMessage, shouldAppendJoinMessageAfterCurrent } = (() => {
        if (!channelJoinInfo || type !== 'thread') return undefined;
        if (prevMessage
          && prevMessage.date < channelJoinInfo.joinedDate && channelJoinInfo.joinedDate <= message.date) {
          return { shouldAppendJoinMessage: true, shouldAppendJoinMessageAfterCurrent: false };
        }

        if (index === arr.length - 1 && message.date < channelJoinInfo.joinedDate) {
          return {
            shouldAppendJoinMessage: true,
            shouldAppendJoinMessageAfterCurrent: true,
          };
        }

        return undefined;
      })() || {};

      if (shouldAppendJoinMessageAfterCurrent) {
        listedMessages.push(message);
      }

      if (shouldAppendJoinMessage) {
        const lastMessageId = shouldAppendJoinMessageAfterCurrent ? message.id : (prevMessage?.id || (message.id - 1));
        listedMessages.push({
          id: generateChannelJoinMessageId(lastMessageId),
          chatId: message.chatId,
          date: channelJoinInfo!.joinedDate,
          isOutgoing: false,
          content: {
            action: {
              type: 'joinedChannel',
              mediaType: 'action',
              text: '',
              translationValues: [],
              targetChatId: message.chatId,
            },
          },
        } satisfies ApiMessage);
      }

      if (!shouldAppendJoinMessageAfterCurrent) {
        listedMessages.push(message);
      }
    });

    // Service notifications have local IDs which may be not in sync with real message history
    const orderRule: (keyof ApiMessage)[] = type === 'scheduled' || isServiceNotificationsChat
      ? ['date', 'id']
      : ['id'];

    return listedMessages.length
      ? groupMessages(
        orderBy(listedMessages, orderRule),
        memoUnreadDividerBeforeIdRef.current,
        !isForum ? Number(threadId) : undefined,
        isChatWithSelf,
      )
      : undefined;
  }, [messageIds, messagesById, type, isServiceNotificationsChat, isForum, threadId, isChatWithSelf, channelJoinInfo]);

  useInterval(() => {
    if (!messageIds || !messagesById || type === 'scheduled') return;
    if (!isChannelChat && !isGroupChat) return;

    const ids = messageIds.filter((id) => {
      const message = messagesById[id];
      return message && message.reactions?.results.length && !message.content.action;
    });

    if (!ids.length) return;

    loadMessageReactions({ chatId, ids });
  }, MESSAGE_REACTIONS_POLLING_INTERVAL);

  useInterval(() => {
    if (!messageIds || !messagesById || type === 'scheduled') {
      return;
    }
    const storyDataList = messageIds.map((id) => messagesById[id]?.content.storyData).filter(Boolean);

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
    const global = getGlobal();
    const ids = messageIds.filter((id) => selectThreadInfo(global, chatId, id)?.isCommentsInfo
      || messagesById[id]?.viewsCount !== undefined);

    if (!ids.length) return;

    loadMessageViews({ chatId, ids });
  }, MESSAGE_COMMENTS_POLLING_INTERVAL, true);

  useInterval(() => {
    if (!messageIds || !messagesById || threadId !== MAIN_THREAD_ID || type === 'scheduled') {
      return;
    }
    const ids = messageIds.filter((id) => messagesById[id]?.factCheck?.shouldFetch);

    if (!ids.length) return;

    loadFactChecks({ chatId, ids });
  }, MESSAGE_FACT_CHECK_UPDATE_INTERVAL);

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
      updateStickyDates(container);
    }

    runDebouncedForScroll(() => {
      const global = getGlobal();

      const isFocusing = Boolean(selectTabState(global).focusedMessage?.chatId);
      if (!isFocusing) {
        onIntersectPinnedMessage({ shouldCancelWaiting: true });
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

    if (!messageIds || messageIds.length === 1 || (
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
    [messageIds, isViewportNewest, rememberScrollPositionRef],
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
          animateScroll({
            container,
            element: shouldScrollToBottom ? lastItemElement! : firstUnreadElement!,
            position: shouldScrollToBottom ? 'end' : 'start',
            margin: BOTTOM_FOCUS_MARGIN,
            forceDuration: noMessageSendingAnimation ? 0 : undefined,
          });
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
          getOffsetToContainer(unreadDivider, container).top - UNREAD_DIVIDER_TOP,
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
  }, [messageIds, isViewportNewest, getContainerHeight, prevContainerHeightRef, noMessageSendingAnimation]);

  useEffectWithPrevDeps(([prevIsSelectModeActive]) => {
    if (prevIsSelectModeActive !== undefined) {
      beginHeavyAnimation(SELECT_MODE_ANIMATION_DURATION + ANIMATION_END_DELAY);
    }
  }, [isSelectModeActive]);

  const isPrivate = isUserId(chatId);
  const withUsers = Boolean((!isPrivate && !isChannelChat)
    || isChatWithSelf || isSystemBotChat || isAnonymousForwards || isChannelWithAvatars);
  const noAvatars = Boolean(!withUsers || (isChannelChat && !isChannelWithAvatars));
  const shouldRenderGreeting = isUserId(chatId) && !isChatWithSelf && !isBot && !isAnonymousForwards
    && type === 'thread'
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
    hasOpenChatButton && 'saved-dialog',
  );

  const hasMessages = (messageIds && messageGroups) || lastMessage;

  useEffect(() => {
    if (hasMessages) return;

    onScrollDownToggle(false);
  }, [hasMessages, onScrollDownToggle]);

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
      ) : isContactRequirePremium && !hasMessages ? (
        <PremiumRequiredMessage userId={chatId} />
      ) : isBot && !hasMessages ? (
        <MessageListBotInfo chatId={chatId} />
      ) : shouldRenderGreeting ? (
        <ContactGreeting key={chatId} userId={chatId} />
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
          canShowAds={areAdsEnabled && isChannelChat}
          chatId={chatId}
          isComments={isComments}
          isChannelChat={isChannelChat}
          isSavedDialog={isSavedDialog}
          messageIds={messageIds || [lastMessage!.id]}
          messageGroups={messageGroups || groupMessages([lastMessage!])}
          getContainerHeight={getContainerHeight}
          isViewportNewest={Boolean(isViewportNewest)}
          isUnread={Boolean(firstUnreadId)}
          isEmptyThread={isEmptyThread}
          withUsers={withUsers}
          noAvatars={noAvatars}
          containerRef={containerRef}
          anchorIdRef={anchorIdRef}
          memoUnreadDividerBeforeIdRef={memoUnreadDividerBeforeIdRef}
          memoFirstUnreadIdRef={memoFirstUnreadIdRef}
          threadId={threadId}
          type={type}
          isReady={isReady}
          hasLinkedChat={hasLinkedChat}
          isSchedule={messageGroups ? type === 'scheduled' : false}
          shouldRenderBotInfo={isBot}
          noAppearanceAnimation={!messageGroups || !shouldAnimateAppearanceRef.current}
          onScrollDownToggle={onScrollDownToggle}
          onNotchToggle={onNotchToggle}
          onIntersectPinnedMessage={onIntersectPinnedMessage}
        />
      ) : (
        <Loading color="white" backgroundColor="dark" />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId, type }): StateProps => {
    const currentUserId = global.currentUserId!;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return { currentUserId };
    }

    const messageIds = selectCurrentMessageIds(global, chatId, threadId, type);
    const messagesById = type === 'scheduled'
      ? selectChatScheduledMessages(global, chatId)
      : selectChatMessages(global, chatId);

    const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);

    if (
      threadId !== MAIN_THREAD_ID && !isSavedDialog && !chat?.isForum
      && !(messagesById && threadId && messagesById[Number(threadId)])
    ) {
      return { currentUserId };
    }

    const { isRestricted, restrictionReason } = chat;
    const lastMessage = selectChatLastMessage(global, chatId, isSavedDialog ? 'saved' : 'all');
    const focusingId = selectFocusedMessageId(global, chatId);

    const withLastMessageWhenPreloading = (
      threadId === MAIN_THREAD_ID
      && !messageIds && !chat.unreadCount && !focusingId && lastMessage && !lastMessage.groupedId
    );

    const chatBot = selectBot(global, chatId);

    const topic = selectTopic(global, chatId, threadId);
    const chatFullInfo = !isUserId(chatId) ? selectChatFullInfo(global, chatId) : undefined;
    const isEmptyThread = !selectThreadInfo(global, chatId, threadId)?.messagesCount;

    const isCurrentUserPremium = selectIsCurrentUserPremium(global);
    const areAdsEnabled = !isCurrentUserPremium || selectUserFullInfo(global, currentUserId)?.areAdsEnabled;

    return {
      areAdsEnabled,
      isChatLoaded: true,
      isRestricted,
      restrictionReason,
      isChannelChat: isChatChannel(chat),
      isGroupChat: isChatGroup(chat),
      isChannelWithAvatars: chat.areProfilesShown,
      isCreator: chat.isCreator,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      isSystemBotChat: isSystemBot(chatId),
      isAnonymousForwards: isAnonymousForwardsChat(chatId),
      isBot: Boolean(chatBot),
      isSynced: global.isSynced,
      messageIds,
      messagesById,
      firstUnreadId: selectFirstUnreadId(global, chatId, threadId),
      isViewportNewest: type !== 'thread' || selectIsViewportNewest(global, chatId, threadId),
      focusingId,
      isSelectModeActive: selectIsInSelectMode(global),
      hasLinkedChat: chatFullInfo ? Boolean(chatFullInfo.linkedChatId) : undefined,
      channelJoinInfo: chatFullInfo?.joinInfo,
      topic,
      noMessageSendingAnimation: !selectPerformanceSettingsValue(global, 'messageSendingAnimations'),
      isServiceNotificationsChat: chatId === SERVICE_NOTIFICATIONS_USER_ID,
      isForum: chat.isForum,
      isEmptyThread,
      currentUserId,
      ...(withLastMessageWhenPreloading && { lastMessage }),
    };
  },
)(MessageList));

function generateChannelJoinMessageId(lastMessageId: number) {
  return lastMessageId + 10e-7; // Smaller than smallest possible id with `getNextLocalMessageId`
}
