import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../lib/teact/teactn';

import {
  ApiAction, ApiMessage, ApiRestrictionReason, MAIN_THREAD_ID,
} from '../../api/types';
import { GlobalActions, MessageListType } from '../../global/types';
import { LoadMoreDirection } from '../../types';

import { ANIMATION_END_DELAY, MESSAGE_LIST_SLICE } from '../../config';
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
  selectScheduledMessages,
  selectCurrentMessageIds,
} from '../../modules/selectors';
import { isChatChannel, isChatGroup, isChatPrivate } from '../../modules/helpers';
import { orderBy, pick } from '../../util/iteratees';
import { fastRaf, debounce, onTickEnd } from '../../util/schedulers';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import buildClassName from '../../util/buildClassName';
import { groupMessages, MessageDateGroup } from './helpers/groupMessages';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';
import useOnChange from '../../hooks/useOnChange';
import useStickyDates from './hooks/useStickyDates';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import resetScroll from '../../util/resetScroll';
import fastSmoothScroll, { isAnimatingScroll } from '../../util/fastSmoothScroll';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';
import useWindowSize from '../../hooks/useWindowSize';

import Loading from '../ui/Loading';
import MessageListContent from './MessageListContent';
import ContactGreeting from './ContactGreeting';
import NoMessages from './NoMessages';

import './MessageList.scss';

type OwnProps = {
  chatId: number;
  threadId: number;
  type: MessageListType;
  canPost: boolean;
  isReady: boolean;
  onFabToggle: (shouldShow: boolean) => void;
  onNotchToggle: (shouldShow: boolean) => void;
  hasTools?: boolean;
};

type StateProps = {
  isChatLoaded?: boolean;
  isChannelChat?: boolean;
  isGroupChat?: boolean;
  isChatWithSelf?: boolean;
  isCreator?: boolean;
  isBot?: boolean;
  messageIds?: number[];
  messagesById?: Record<number, ApiMessage>;
  firstUnreadId?: number;
  isViewportNewest?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
  focusingId?: number;
  hasFocusHighlight?: boolean;
  isSelectModeActive?: boolean;
  animationLevel?: number;
  lastMessage?: ApiMessage;
  botDescription?: string;
  threadTopMessageId?: number;
  threadFirstMessageId?: number;
  hasLinkedChat?: boolean;
};

type DispatchProps = Pick<GlobalActions, 'loadViewportMessages' | 'setScrollOffset' | 'openHistoryCalendar'>;

const BOTTOM_THRESHOLD = 100;
const UNREAD_DIVIDER_TOP = 10;
const UNREAD_DIVIDER_TOP_WITH_TOOLS = 60;
const SCROLL_DEBOUNCE = 200;
const FOCUSING_DURATION = 1000;
const BOTTOM_FOCUS_MARGIN = 20;
const SELECT_MODE_ANIMATION_DURATION = 200;
const UNREAD_DIVIDER_CLASS = 'unread-divider';

const runDebouncedForScroll = debounce((cb) => cb(), SCROLL_DEBOUNCE, false);

const MessageList: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  threadId,
  type,
  hasTools,
  onFabToggle,
  onNotchToggle,
  isChatLoaded,
  isChannelChat,
  isGroupChat,
  canPost,
  isReady,
  isChatWithSelf,
  isCreator,
  isBot,
  messageIds,
  messagesById,
  firstUnreadId,
  isViewportNewest,
  threadFirstMessageId,
  isRestricted,
  restrictionReason,
  focusingId,
  hasFocusHighlight,
  isSelectModeActive,
  loadViewportMessages,
  setScrollOffset,
  lastMessage,
  botDescription,
  threadTopMessageId,
  hasLinkedChat,
  openHistoryCalendar,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  // We update local cached `scrollOffsetRef` when opening chat.
  // Then we update global version every second on scrolling.
  const scrollOffsetRef = useRef<number>((type === 'thread' && selectScrollOffset(getGlobal(), chatId, threadId)) || 0);
  const anchorIdRef = useRef<string>();
  const anchorTopRef = useRef<number>();
  const listItemElementsRef = useRef<HTMLDivElement[]>();
  const memoUnreadDividerBeforeIdRef = useRef<number | undefined>();
  // Updated every time (to be used from intersection callback closure)
  const memoFirstUnreadIdRef = useRef<number>();
  const memoFocusingIdRef = useRef<number>();
  const isScrollTopJustUpdatedRef = useRef(false);
  const shouldAnimateAppearanceRef = useRef(Boolean(lastMessage));

  const [containerHeight, setContainerHeight] = useState<number | undefined>();

  const areMessagesLoaded = Boolean(messageIds);

  useOnChange(() => {
    // We only need it first time when message list appears
    if (areMessagesLoaded) {
      onTickEnd(() => {
        shouldAnimateAppearanceRef.current = false;
      });
    }
  }, [areMessagesLoaded]);

  useOnChange(() => {
    memoFirstUnreadIdRef.current = firstUnreadId;

    // Updated only once (to preserve divider even after messages are read)
    if (!memoUnreadDividerBeforeIdRef.current) {
      memoUnreadDividerBeforeIdRef.current = firstUnreadId;
    }
  }, [firstUnreadId]);

  useOnChange(() => {
    memoFocusingIdRef.current = focusingId;
  }, [focusingId]);

  const messageGroups = useMemo(() => {
    if (!messageIds || !messagesById) {
      return undefined;
    }

    const viewportIds = threadTopMessageId && (!messageIds[0] || threadFirstMessageId === messageIds[0])
      ? [threadTopMessageId, ...messageIds]
      : messageIds;

    if (!viewportIds.length) {
      return undefined;
    }

    const listedMessages = viewportIds.map((id) => messagesById[id]).filter(Boolean);
    return groupMessages(orderBy(listedMessages, ['date', 'id']), memoUnreadDividerBeforeIdRef.current);
  }, [messageIds, messagesById, threadFirstMessageId, threadTopMessageId]);

  const loadMoreAround = useMemo(() => {
    if (type !== 'thread') {
      return undefined;
    }

    return debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Around }), 1000, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadViewportMessages, messageIds]);

  const { isScrolled, updateStickyDates } = useStickyDates();

  const handleScroll = useCallback(() => {
    if (isScrollTopJustUpdatedRef.current) {
      isScrollTopJustUpdatedRef.current = false;
      return;
    }

    const container = containerRef.current!;

    if (!memoFocusingIdRef.current) {
      updateStickyDates(container, hasTools);
    }

    runDebouncedForScroll(() => {
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
  useEffect(() => {
    if (!('ResizeObserver' in window) || process.env.APP_ENV === 'perf') {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      // During animation
      if (!(entry.target as HTMLDivElement).offsetParent) {
        return;
      }

      setContainerHeight(entry.contentRect.height);
    });

    observer.observe(containerRef.current!);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Memorize height for scroll animation
  const { height: windowHeight } = useWindowSize();

  useEffect(() => {
    if (isReady) {
      containerRef.current!.dataset.normalHeight = String(containerRef.current!.offsetHeight);
    }
  }, [windowHeight, isReady]);

  // Initial message loading
  useEffect(() => {
    if (!loadMoreAround || !isChatLoaded || isRestricted || focusingId) {
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
  useOnChange(() => {
    if (!messageIds || !listItemElementsRef.current || !isReady) {
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
  }, [messageIds, isViewportNewest, containerHeight, hasTools, isReady]);

  // Handles updated message list, takes care of scroll repositioning
  useLayoutEffectWithPrevDeps(([
    prevMessageIds, prevIsViewportNewest, prevContainerHeight,
  ]: [
    typeof messageIds, typeof isViewportNewest, typeof containerHeight
  ]) => {
    const container = containerRef.current!;
    listItemElementsRef.current = Array.from(container.querySelectorAll<HTMLDivElement>('.message-list-item'));

    // During animation
    if (!container.offsetParent) {
      return;
    }

    // Add extra height when few messages to allow smooth scroll animation. Uses assumption that `parentElement`
    // is a Transition slide and its CSS class can not be reset in a declarative way.
    const shouldForceScroll = (
      isViewportNewest
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
      }, FOCUSING_DURATION);
    }

    const { scrollTop, scrollHeight, offsetHeight } = container;
    const scrollOffset = scrollOffsetRef.current!;
    const lastItemElement = listItemElementsRef.current[listItemElementsRef.current.length - 1];

    // If two messages come at once (e.g. via Quiz Bot) then the first message will update `scrollOffset`
    // right away (before animation) which creates inconsistency until the animation completes.
    // To workaround that, we calculate `isAtBottom` with a "buffer" of the latest message height (this is approximate).
    const lastItemHeight = lastItemElement ? lastItemElement.offsetHeight : 0;
    const isAtBottom = isViewportNewest && prevIsViewportNewest && (
      scrollOffset - (prevContainerHeight || offsetHeight) - lastItemHeight <= BOTTOM_THRESHOLD
    );

    let newScrollTop!: number;

    const hasFirstMessageChanged = messageIds && prevMessageIds && messageIds[0] !== prevMessageIds[0];
    const hasLastMessageChanged = (
      messageIds && prevMessageIds && messageIds[messageIds.length - 1] !== prevMessageIds[prevMessageIds.length - 1]
    );
    const isAlreadyFocusing = messageIds && memoFocusingIdRef.current === messageIds[messageIds.length - 1];

    if (isAtBottom && hasLastMessageChanged && !hasFirstMessageChanged && !isAlreadyFocusing) {
      if (lastItemElement) {
        fastRaf(() => {
          fastSmoothScroll(
            container,
            lastItemElement,
            'end',
            BOTTOM_FOCUS_MARGIN,
            undefined,
            undefined,
            undefined,
            true,
          );
        });
      }

      newScrollTop = scrollHeight - offsetHeight;
      scrollOffsetRef.current = Math.max(scrollHeight - newScrollTop, offsetHeight);

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

    resetScroll(container, newScrollTop);

    if (!memoFocusingIdRef.current) {
      isScrollTopJustUpdatedRef.current = true;
      fastRaf(() => {
        isScrollTopJustUpdatedRef.current = false;
      });
    }

    scrollOffsetRef.current = Math.max(scrollHeight - newScrollTop, offsetHeight);

    if (process.env.APP_ENV === 'perf') {
      // eslint-disable-next-line no-console
      console.timeEnd('scrollTop');
    }
    // This should match deps for `useOnChange` above
  }, [messageIds, isViewportNewest, containerHeight, hasTools]);

  useEffectWithPrevDeps(([prevIsSelectModeActive]) => {
    if (prevIsSelectModeActive !== undefined) {
      dispatchHeavyAnimationEvent(SELECT_MODE_ANIMATION_DURATION + ANIMATION_END_DELAY);
    }
  }, [isSelectModeActive]);

  const lang = useLang();

  const isPrivate = Boolean(chatId && isChatPrivate(chatId));
  const withUsers = Boolean((!isPrivate && !isChannelChat) || isChatWithSelf);
  const noAvatars = Boolean(!withUsers || isChannelChat);
  const shouldRenderGreeting = isChatPrivate(chatId) && !isChatWithSelf && !isBot
    && ((
      !messageGroups && !lastMessage && messageIds
      // Used to avoid flickering when deleting a greeting that has just been sent
      && (!listItemElementsRef.current || listItemElementsRef.current.length === 0))
      || checkSingleMessageActionByType('contactSignUp', messageGroups)
      || (lastMessage && lastMessage.content.action && lastMessage.content.action.type === 'contactSignUp')
    );
  const isGroupChatJustCreated = isGroupChat && isCreator
    && checkSingleMessageActionByType('chatCreate', messageGroups);

  const className = buildClassName(
    'MessageList custom-scroll',
    noAvatars && 'no-avatars',
    !canPost && 'no-composer',
    type === 'pinned' && 'type-pinned',
    hasFocusHighlight && 'has-focus-highlight',
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
      ) : botDescription ? (
        <div className="empty rich"><span>{renderText(lang(botDescription), ['br', 'emoji', 'links'])}</span></div>
      ) : shouldRenderGreeting ? (
        <ContactGreeting userId={chatId} />
      ) : messageIds && (!messageGroups || isGroupChatJustCreated) ? (
        <NoMessages
          chatId={chatId}
          type={type}
          isChatWithSelf={isChatWithSelf}
          isGroupChatJustCreated={isGroupChatJustCreated}
        />
      ) : ((messageIds && messageGroups) || lastMessage) ? (
        <MessageListContent
          messageIds={messageIds || [lastMessage!.id]}
          messageGroups={messageGroups || groupMessages([lastMessage!])}
          isViewportNewest={Boolean(isViewportNewest)}
          isUnread={Boolean(firstUnreadId)}
          withUsers={withUsers}
          noAvatars={noAvatars}
          containerRef={containerRef}
          anchorIdRef={anchorIdRef}
          memoFirstUnreadIdRef={memoUnreadDividerBeforeIdRef}
          threadId={threadId}
          type={type}
          threadTopMessageId={threadTopMessageId}
          hasLinkedChat={hasLinkedChat}
          isSchedule={messageGroups ? type === 'scheduled' : false}
          noAppearanceAnimation={!messageGroups || !shouldAnimateAppearanceRef.current}
          onFabToggle={onFabToggle}
          onNotchToggle={onNotchToggle}
          openHistoryCalendar={openHistoryCalendar}
        />
      ) : (
        <Loading color="white" />
      )}
    </div>
  );
};

function checkSingleMessageActionByType(type: ApiAction['type'], messageGroups?: MessageDateGroup[]) {
  return messageGroups
  && messageGroups.length === 1
  && messageGroups[0].senderGroups.length === 1
  && messageGroups[0].senderGroups[0].length === 1
  && 'content' in messageGroups[0].senderGroups[0][0]
  && messageGroups[0].senderGroups[0][0].content.action
  && messageGroups[0].senderGroups[0][0].content.action.type === type;
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId, type }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return {};
    }

    const messageIds = selectCurrentMessageIds(global, chatId, threadId, type);
    const messagesById = type === 'scheduled'
      ? selectScheduledMessages(global, chatId)
      : selectChatMessages(global, chatId);
    const threadTopMessageId = selectThreadTopMessageId(global, chatId, threadId);

    if (
      threadId !== MAIN_THREAD_ID
      && !(messagesById && threadTopMessageId && messagesById[threadTopMessageId])
    ) {
      return {};
    }

    const { isRestricted, restrictionReason, lastMessage } = chat;
    const focusingId = selectFocusedMessageId(global, chatId);
    const hasFocusHighlight = focusingId ? !global.focusedMessage!.noHighlight : undefined;

    const withLastMessageWhenPreloading = (
      threadId === MAIN_THREAD_ID
      && !messageIds && !chat.unreadCount && !focusingId && lastMessage && !lastMessage.groupedId
    );

    const bot = selectChatBot(global, chatId);
    let botDescription: string | undefined;
    if (selectIsChatBotNotStarted(global, chatId)) {
      const chatBot = selectChatBot(global, chatId)!;
      if (chatBot.fullInfo) {
        botDescription = chatBot.fullInfo.botDescription || 'NoMessages';
      } else {
        botDescription = 'Updating bot info...';
      }
    }

    return {
      isChatLoaded: true,
      isRestricted,
      restrictionReason,
      isChannelChat: isChatChannel(chat),
      isGroupChat: isChatGroup(chat),
      isCreator: chat.isCreator,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      isBot: Boolean(bot),
      messageIds,
      messagesById,
      firstUnreadId: selectFirstUnreadId(global, chatId, threadId),
      isViewportNewest: type !== 'thread' || selectIsViewportNewest(global, chatId, threadId),
      threadFirstMessageId: selectFirstMessageId(global, chatId, threadId),
      focusingId,
      hasFocusHighlight,
      isSelectModeActive: selectIsInSelectMode(global),
      botDescription,
      threadTopMessageId,
      hasLinkedChat: chat.fullInfo && ('linkedChatId' in chat.fullInfo)
        ? Boolean(chat.fullInfo.linkedChatId)
        : undefined,
      ...(withLastMessageWhenPreloading && { lastMessage }),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadViewportMessages',
    'setScrollOffset',
    'openHistoryCalendar',
  ]),
)(MessageList));
