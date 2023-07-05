import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
} from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../lib/teact/teact-dom';
import { requestForcedReflow, forceMeasure, requestMeasure } from '../../lib/fasterdom/fasterdom';

import type { FC } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';
import type {
  ApiBotInfo, ApiMessage, ApiRestrictionReason, ApiTopic,
} from '../../api/types';

import { MAIN_THREAD_ID } from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { Signal } from '../../util/signals';
import type { PinnedIntersectionChangedCallback } from './hooks/usePinnedMessage';
import { LoadMoreDirection } from '../../types';

import {
  ANIMATION_END_DELAY,
  MESSAGE_LIST_SLICE,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import {
  selectChatMessages,
  selectIsViewportNewest,
  selectFirstUnreadId,
  selectFocusedMessageId,
  selectChat,
  selectIsInSelectMode,
  selectIsChatWithSelf,
  selectBot,
  selectIsChatBotNotStarted,
  selectScrollOffset,
  selectThreadTopMessageId,
  selectChatScheduledMessages,
  selectCurrentMessageIds,
  selectIsCurrentUserPremium,
  selectLastScrollOffset,
  selectThreadInfo,
  selectTabState,
  selectUserFullInfo,
  selectChatFullInfo,
  selectPerformanceSettingsValue,
} from '../../global/selectors';
import {
  isChatChannel,
  isUserId,
  isChatWithRepliesBot,
  isChatGroup,
  getBotCoverMediaHash,
  getDocumentMediaHash,
  getVideoDimensions,
  getPhotoFullDimensions,
  isLocalMessageId,
} from '../../global/helpers';
import { orderBy } from '../../util/iteratees';
import { DPR } from '../../util/windowEnvironment';
import { debounce, onTickEnd } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import { groupMessages } from './helpers/groupMessages';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';
import resetScroll from '../../util/resetScroll';
import animateScroll, { isAnimatingScroll, restartCurrentScrollAnimation } from '../../util/animateScroll';
import renderText from '../common/helpers/renderText';

import useLastCallback from '../../hooks/useLastCallback';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import useStickyDates from './hooks/useStickyDates';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useLang from '../../hooks/useLang';
import useInterval from '../../hooks/useInterval';
import useNativeCopySelectedMessages from '../../hooks/useNativeCopySelectedMessages';
import useMedia from '../../hooks/useMedia';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useContainerHeight from './hooks/useContainerHeight';
import { isBackgroundModeActive } from '../../hooks/useBackgroundMode';

import Loading from '../ui/Loading';
import MessageListContent from './MessageListContent';
import ContactGreeting from './ContactGreeting';
import NoMessages from './NoMessages';
import Skeleton from '../ui/Skeleton';
import OptimizedVideo from '../ui/OptimizedVideo';

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
  isLoadingBotInfo?: boolean;
  botInfo?: ApiBotInfo;
  threadTopMessageId?: number;
  hasLinkedChat?: boolean;
  lastSyncTime?: number;
  topic?: ApiTopic;
  noMessageSendingAnimation?: boolean;
  isServiceNotificationsChat?: boolean;
};

const MESSAGE_REACTIONS_POLLING_INTERVAL = 15 * 1000;
const MESSAGE_COMMENTS_POLLING_INTERVAL = 15 * 1000;
const BOTTOM_THRESHOLD = 50;
const UNREAD_DIVIDER_TOP = 10;
const UNREAD_DIVIDER_TOP_WITH_TOOLS = 60;
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
  hasTools,
  onFabToggle,
  onNotchToggle,
  isCurrentUserPremium,
  isChatLoaded,
  isChannelChat,
  isGroupChat,
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
  isLoadingBotInfo,
  botInfo,
  threadTopMessageId,
  hasLinkedChat,
  lastSyncTime,
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
    loadMessageViews,
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

  const botInfoPhotoUrl = useMedia(botInfo?.photo ? getBotCoverMediaHash(botInfo.photo) : undefined);
  const botInfoGifUrl = useMedia(botInfo?.gif ? getDocumentMediaHash(botInfo.gif) : undefined);
  const botInfoDimensions = botInfo?.photo ? getPhotoFullDimensions(botInfo.photo) : botInfo?.gif
    ? getVideoDimensions(botInfo.gif) : undefined;
  const botInfoRealDimensions = botInfoDimensions && {
    width: botInfoDimensions.width / DPR,
    height: botInfoDimensions.height / DPR,
  };

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
    if (!isCurrentUserPremium && isChannelChat && isReady && lastSyncTime) {
      loadSponsoredMessages({ chatId });
    }
  }, [isCurrentUserPremium, chatId, isReady, isChannelChat, lastSyncTime, loadSponsoredMessages]);

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

    const listedMessages = messageIds.map((id) => messagesById[id]).filter(Boolean);

    // Service notifications have local IDs which may be not in sync with real message history
    const orderRule: (keyof ApiMessage)[] = type === 'scheduled' || isServiceNotificationsChat
      ? ['date', 'id']
      : ['id'];

    return listedMessages.length
      ? groupMessages(orderBy(listedMessages, orderRule), memoUnreadDividerBeforeIdRef.current)
      : undefined;
  }, [messageIds, messagesById, type, isServiceNotificationsChat]);

  useInterval(() => {
    if (!messageIds || !messagesById || type === 'scheduled') {
      return;
    }
    const ids = messageIds.filter((id) => messagesById[id]?.reactions);

    if (!ids.length) return;

    loadMessageReactions({ chatId, ids });
  }, MESSAGE_REACTIONS_POLLING_INTERVAL);

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

      // Animate incoming message
      if (wasMessageAdded && isAtBottom && !isAlreadyFocusing && !isBackgroundModeActive()) {
        // Break out of `forceLayout`
        requestMeasure(() => {
          animateScroll(
            container,
            lastItemElement!,
            'end',
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

  const lang = useLang();

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

  const isBotInfoEmpty = botInfo && !botInfo.description && !botInfo.gif && !botInfo.photo;

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
      ) : botInfo ? (
        <div className="empty">
          {isLoadingBotInfo && <span>{lang('Loading')}</span>}
          {isBotInfoEmpty && !isLoadingBotInfo && <span>{lang('NoMessages')}</span>}
          {botInfo && (
            <div
              className="bot-info"
              style={botInfoRealDimensions && (
                `width: ${botInfoRealDimensions.width}px`
              )}
            >
              {botInfoPhotoUrl && (
                <img
                  src={botInfoPhotoUrl}
                  width={botInfoRealDimensions?.width}
                  height={botInfoRealDimensions?.height}
                  alt="Bot info"
                />
              )}
              {botInfoGifUrl && (
                <OptimizedVideo
                  canPlay
                  src={botInfoGifUrl}
                  loop
                  disablePictureInPicture
                  muted
                  playsInline
                />
              )}
              {botInfoDimensions && !botInfoPhotoUrl && !botInfoGifUrl && (
                <Skeleton
                  width={botInfoRealDimensions?.width}
                  height={botInfoRealDimensions?.height}
                />
              )}
              {botInfo.description && (
                <div className="bot-info-description">
                  <p className="bot-info-title">{lang('BotInfoTitle')}</p>
                  {renderText(botInfo.description, ['br', 'emoji', 'links'])}
                </div>
              )}
            </div>
          )}
        </div>
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
      ) : ((messageIds && messageGroups) || lastMessage) ? (
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

    const chatBot = selectBot(global, chatId)!;
    let isLoadingBotInfo = false;
    let botInfo;
    if (selectIsChatBotNotStarted(global, chatId)) {
      const chatBotFullInfo = selectUserFullInfo(global, chatBot.id);
      if (chatBotFullInfo) {
        botInfo = chatBotFullInfo.botInfo;
      } else {
        isLoadingBotInfo = true;
      }
    }

    const topic = chat.topics?.[threadId];
    const chatFullInfo = !isUserId(chatId) ? selectChatFullInfo(global, chatId) : undefined;

    return {
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isChatLoaded: true,
      isRestricted,
      restrictionReason,
      isChannelChat: isChatChannel(chat),
      isGroupChat: isChatGroup(chat),
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
      isLoadingBotInfo,
      botInfo,
      threadTopMessageId,
      hasLinkedChat: chatFullInfo ? Boolean(chatFullInfo.linkedChatId) : undefined,
      lastSyncTime: global.lastSyncTime,
      topic,
      noMessageSendingAnimation: !selectPerformanceSettingsValue(global, 'messageSendingAnimations'),
      isServiceNotificationsChat: chatId === SERVICE_NOTIFICATIONS_USER_ID,
      ...(withLastMessageWhenPreloading && { lastMessage }),
    };
  },
)(MessageList));
