import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiBotInfo, ApiMessage, ApiRestrictionReason, ApiTopic,
} from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { AnimationLevel } from '../../types';
import { LoadMoreDirection } from '../../types';

import { ANIMATION_END_DELAY, LOCAL_MESSAGE_MIN_ID, MESSAGE_LIST_SLICE } from '../../config';
import {
  selectChatMessages,
  selectIsViewportNewest,
  selectFirstUnreadId,
  selectFocusedMessageId,
  selectChat,
  selectIsInSelectMode,
  selectIsChatWithSelf,
  selectChatBot,
  selectIsChatBotNotStarted,
  selectScrollOffset,
  selectThreadTopMessageId,
  selectFirstMessageId,
  selectChatScheduledMessages,
  selectCurrentMessageIds,
  selectIsCurrentUserPremium, selectLastScrollOffset, selectThreadInfo,
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
} from '../../global/helpers';
import { orderBy } from '../../util/iteratees';
import { DPR } from '../../util/environment';
import { fastRaf, debounce, onTickEnd } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import { groupMessages } from './helpers/groupMessages';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';
import resetScroll, { patchChromiumScroll } from '../../util/resetScroll';
import fastSmoothScroll, { isAnimatingScroll } from '../../util/fastSmoothScroll';
import renderText from '../common/helpers/renderText';

import useSyncEffect from '../../hooks/useSyncEffect';
import useStickyDates from './hooks/useStickyDates';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useLang from '../../hooks/useLang';
import useWindowSize from '../../hooks/useWindowSize';
import useInterval from '../../hooks/useInterval';
import useNativeCopySelectedMessages from '../../hooks/useNativeCopySelectedMessages';
import useMedia from '../../hooks/useMedia';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useResizeObserver from '../../hooks/useResizeObserver';

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
  animationLevel?: AnimationLevel;
  lastMessage?: ApiMessage;
  isLoadingBotInfo?: boolean;
  botInfo?: ApiBotInfo;
  threadTopMessageId?: number;
  threadFirstMessageId?: number;
  hasLinkedChat?: boolean;
  lastSyncTime?: number;
  topic?: ApiTopic;
};

const MESSAGE_REACTIONS_POLLING_INTERVAL = 15 * 1000;
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
  threadFirstMessageId,
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
}) => {
  const {
    loadViewportMessages, setScrollOffset, loadSponsoredMessages, loadMessageReactions, copyMessagesByIds,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  // We update local cached `scrollOffsetRef` when opening chat.
  // Then we update global version every second on scrolling.
  const scrollOffsetRef = useRef<number>((type === 'thread'
    && selectScrollOffset(getGlobal(), chatId, threadId))
    || selectLastScrollOffset(getGlobal(), chatId, threadId)
    || 0);

  const anchorIdRef = useRef<string>();
  const anchorTopRef = useRef<number>();
  const listItemElementsRef = useRef<HTMLDivElement[]>();
  const memoFirstUnreadIdRef = useRef<number>();
  const memoUnreadDividerBeforeIdRef = useRef<number | undefined>();
  const memoFocusingIdRef = useRef<number>();
  const isScrollTopJustUpdatedRef = useRef(false);
  const shouldAnimateAppearanceRef = useRef(Boolean(lastMessage));

  const [containerHeight, setContainerHeight] = useState<number | undefined>();

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
    if (!messageIds || !messagesById) {
      return undefined;
    }

    const viewportIds = threadTopMessageId && threadFirstMessageId !== threadTopMessageId
      && (!messageIds[0] || threadFirstMessageId === messageIds[0])
      ? [threadTopMessageId, ...messageIds]
      : messageIds;

    if (!viewportIds.length) {
      return undefined;
    }

    const listedMessages = viewportIds.map((id) => messagesById[id]).filter(Boolean);
    return listedMessages.length
      ? groupMessages(orderBy(listedMessages, ['date', 'id']), memoUnreadDividerBeforeIdRef.current)
      : undefined;
  }, [messageIds, messagesById, threadFirstMessageId, threadTopMessageId]);

  useInterval(() => {
    if (!messageIds || !messagesById) {
      return;
    }
    const ids = messageIds.filter((id) => messagesById[id]?.reactions);

    if (!ids.length) return;

    loadMessageReactions({ chatId, ids });
  }, MESSAGE_REACTIONS_POLLING_INTERVAL);

  const loadMoreAround = useMemo(() => {
    if (type !== 'thread') {
      return undefined;
    }

    return debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Around }), 1000, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadViewportMessages, messageIds]);

  const { isScrolled, updateStickyDates } = useStickyDates();

  const isScrollingRef = useRef<boolean>();
  const isScrollPatchNeededRef = useRef<boolean>();

  const handleScroll = useCallback(() => {
    if (isScrollTopJustUpdatedRef.current) {
      isScrollTopJustUpdatedRef.current = false;
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    isScrollingRef.current = true;

    if (!memoFocusingIdRef.current) {
      updateStickyDates(container, hasTools);
    }

    runDebouncedForScroll(() => {
      isScrollingRef.current = false;

      fastRaf(() => {
        if (!container.parentElement) {
          return;
        }

        scrollOffsetRef.current = container.scrollHeight - container.scrollTop;

        if (type === 'thread') {
          setScrollOffset({ chatId, threadId, scrollOffset: scrollOffsetRef.current });
        }
      });
    });
  }, [updateStickyDates, hasTools, type, setScrollOffset, chatId, threadId]);

  // Container resize observer (caused by Composer reply/webpage panels)
  const handleResize = useCallback((entry: ResizeObserverEntry) => {
    setContainerHeight(entry.contentRect.height);
  }, []);
  useResizeObserver(containerRef, handleResize);

  // Memorize height for scroll animation
  const { height: windowHeight } = useWindowSize();

  useEffect(() => {
    containerRef.current!.dataset.normalHeight = String(containerRef.current!.offsetHeight);
  }, [windowHeight, canPost]);

  // Initial message loading
  useEffect(() => {
    if (!loadMoreAround || !isChatLoaded || isRestricted || focusingId) {
      return;
    }

    // Loading history while sending a message can return the same message and cause ambiguity
    const isLastMessageLocal = messageIds && messageIds[messageIds.length - 1] > LOCAL_MESSAGE_MIN_ID;
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

  // Remember scroll position before repositioning it
  useSyncEffect(() => {
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
    // This should match deps for `useLayoutEffectWithPrevDeps` below
  }, [messageIds, isViewportNewest, containerHeight, hasTools]);

  // Handles updated message list, takes care of scroll repositioning
  useLayoutEffectWithPrevDeps(([
    prevMessageIds, prevIsViewportNewest, prevContainerHeight,
  ]) => {
    const container = containerRef.current!;
    listItemElementsRef.current = Array.from(container.querySelectorAll<HTMLDivElement>('.message-list-item'));

    const hasLastMessageChanged = (
      messageIds && prevMessageIds && messageIds[messageIds.length - 1] !== prevMessageIds[prevMessageIds.length - 1]
    );
    const hasViewportShifted = (
      messageIds?.[0] !== prevMessageIds?.[0] && messageIds?.length === (MESSAGE_LIST_SLICE / 2 + 1)
    );
    const wasMessageAdded = hasLastMessageChanged && !hasViewportShifted;
    const isAlreadyFocusing = messageIds && memoFocusingIdRef.current === messageIds[messageIds.length - 1];

    // Add extra height when few messages to allow smooth scroll animation. Uses assumption that `parentElement`
    // is a Transition slide and its CSS class can not be reset in a declarative way.
    const shouldForceScroll = (
      isViewportNewest
      && wasMessageAdded
      && (messageIds && messageIds.length < MESSAGE_LIST_SLICE / 2)
      && !container.parentElement!.classList.contains('force-messages-scroll')
      && (container.firstElementChild as HTMLDivElement)!.clientHeight <= container.offsetHeight * 2
    );

    if (shouldForceScroll) {
      container.parentElement!.classList.add('force-messages-scroll');

      setTimeout(() => {
        if (container.parentElement) {
          container.parentElement.classList.remove('force-messages-scroll');
        }
      }, MESSAGE_ANIMATION_DURATION);
    }

    const { scrollTop, scrollHeight, offsetHeight } = container;
    const scrollOffset = scrollOffsetRef.current;
    const lastItemElement = listItemElementsRef.current[listItemElementsRef.current.length - 1];

    let bottomOffset = scrollOffset - (prevContainerHeight || offsetHeight);
    if (wasMessageAdded) {
      // If two new messages come at once (e.g. when bot responds) then the first message will update `scrollOffset`
      // right away (before animation) which creates inconsistency until the animation completes. To work around that,
      // we calculate `isAtBottom` with a "buffer" of the latest message height (this is approximate).
      const lastItemHeight = lastItemElement ? lastItemElement.offsetHeight : 0;
      bottomOffset -= lastItemHeight;
    }
    const isAtBottom = isViewportNewest && prevIsViewportNewest && bottomOffset <= BOTTOM_THRESHOLD;

    let newScrollTop!: number;

    if (wasMessageAdded && isAtBottom && !isAlreadyFocusing) {
      if (lastItemElement) {
        fastRaf(() => {
          fastSmoothScroll(
            container,
            lastItemElement,
            'end',
            BOTTOM_FOCUS_MARGIN,
          );
        });
      }

      newScrollTop = scrollHeight - offsetHeight;
      scrollOffsetRef.current = Math.max(Math.ceil(scrollHeight - newScrollTop), offsetHeight);

      // Scroll still needs to be restored after container resize
      if (!shouldForceScroll) {
        return;
      }
    }

    if (process.env.APP_ENV === 'perf') {
      // eslint-disable-next-line no-console
      console.time('scrollTop');
    }

    const isResized = prevContainerHeight !== undefined && prevContainerHeight !== containerHeight;
    const anchor = anchorIdRef.current && container.querySelector(`#${anchorIdRef.current}`);
    const unreadDivider = (
      !anchor
      && memoUnreadDividerBeforeIdRef.current
      && container.querySelector<HTMLDivElement>(`.${UNREAD_DIVIDER_CLASS}`)
    );

    if (isAtBottom && isResized) {
      if (isAnimatingScroll()) {
        return;
      }

      newScrollTop = scrollHeight - offsetHeight;
    } else if (anchor) {
      if (isScrollPatchNeededRef.current) {
        isScrollPatchNeededRef.current = false;
        patchChromiumScroll(container);
      }

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

    resetScroll(container, Math.ceil(newScrollTop));

    if (!memoFocusingIdRef.current) {
      isScrollTopJustUpdatedRef.current = true;
      fastRaf(() => {
        isScrollTopJustUpdatedRef.current = false;
      });
    }

    scrollOffsetRef.current = Math.max(Math.ceil(scrollHeight - newScrollTop), offsetHeight);

    if (process.env.APP_ENV === 'perf') {
      // eslint-disable-next-line no-console
      console.timeEnd('scrollTop');
    }
    // This should match deps for `useSyncEffect` above
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `as const` not yet supported by linter
  }, [messageIds, isViewportNewest, containerHeight, hasTools] as const);

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
          isScrollingRef={isScrollingRef}
          isScrollPatchNeededRef={isScrollPatchNeededRef}
          threadTopMessageId={threadTopMessageId}
          hasLinkedChat={hasLinkedChat}
          isSchedule={messageGroups ? type === 'scheduled' : false}
          noAppearanceAnimation={!messageGroups || !shouldAnimateAppearanceRef.current}
          onFabToggle={onFabToggle}
          onNotchToggle={onNotchToggle}
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

    const chatBot = selectChatBot(global, chatId)!;
    let isLoadingBotInfo = false;
    let botInfo;
    if (selectIsChatBotNotStarted(global, chatId)) {
      if (chatBot.fullInfo) {
        botInfo = chatBot.fullInfo.botInfo;
      } else {
        isLoadingBotInfo = true;
      }
    }

    const topic = chat.topics?.[threadId];

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
      threadFirstMessageId: selectFirstMessageId(global, chatId, threadId),
      focusingId,
      isSelectModeActive: selectIsInSelectMode(global),
      isLoadingBotInfo,
      botInfo,
      threadTopMessageId,
      hasLinkedChat: chat.fullInfo && ('linkedChatId' in chat.fullInfo)
        ? Boolean(chat.fullInfo.linkedChatId)
        : undefined,
      lastSyncTime: global.lastSyncTime,
      topic,
      ...(withLastMessageWhenPreloading && { lastMessage }),
    };
  },
)(MessageList));
