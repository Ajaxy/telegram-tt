import React, {
  FC, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../lib/teact/teactn';

import { ApiMessage, ApiRestrictionReason, MAIN_THREAD_ID } from '../../api/types';
import { GlobalActions, MessageListType } from '../../global/types';
import { LoadMoreDirection } from '../../types';

import { ANIMATION_END_DELAY, MESSAGE_LIST_SLICE, SCHEDULED_WHEN_ONLINE } from '../../config';
import { IS_ANDROID, IS_IOS, IS_MOBILE_SCREEN } from '../../util/environment';
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
  selectScheduledMessages, selectCurrentMessageIds,
} from '../../modules/selectors';
import {
  getMessageOriginalId,
  isActionMessage,
  isChatChannel,
  isChatPrivate,
  isOwnMessage,
  getCanPostInChat,
} from '../../modules/helpers';
import {
  compact,
  flatten,
  orderBy,
  pick,
} from '../../util/iteratees';
import {
  fastRaf, debounce, throttleWithTickEnd,
} from '../../util/schedulers';
import { formatHumanDate } from '../../util/dateFormat';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import buildClassName from '../../util/buildClassName';
import { groupMessages, MessageDateGroup, isAlbum } from './helpers/groupMessages';
import { ObserveFn, useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useOnChange from '../../hooks/useOnChange';
import useStickyDates from './hooks/useStickyDates';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import resetScroll from '../../util/resetScroll';
import fastSmoothScroll from '../../util/fastSmoothScroll';
import renderText from '../common/helpers/renderText';
import useLang, { LangFn } from '../../hooks/useLang';

import Loading from '../ui/Loading';
import MessageScroll from './MessageScroll';
import Message from './message/Message';
import ActionMessage from './ActionMessage';

import './MessageList.scss';

type OwnProps = {
  chatId: number;
  threadId: number;
  type: MessageListType;
  onFabToggle: (show: boolean) => void;
  hasTools?: boolean;
  bottomOffset: 'none' | 'small' | 'big';
};

type StateProps = {
  isChatLoaded?: boolean;
  isChannelChat?: boolean;
  canPost?: boolean;
  isChatWithSelf?: boolean;
  messageIds?: number[];
  messagesById?: Record<number, ApiMessage>;
  firstUnreadId?: number;
  isViewportNewest?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
  focusingId?: number;
  isSelectModeActive?: boolean;
  animationLevel?: number;
  lastMessage?: ApiMessage;
  botDescription?: string;
  threadTopMessageId?: number;
  threadFirstMessageId?: number;
  hasLinkedChat?: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'loadViewportMessages' | 'markMessageListRead' | 'markMessagesRead' | 'setScrollOffset'
)>;

const BOTTOM_THRESHOLD = 100;
const UNREAD_DIVIDER_TOP = 10;
const UNREAD_DIVIDER_TOP_WITH_TOOLS = 60;
const SCROLL_DEBOUNCE = 200;
const INTERSECTION_THROTTLE_FOR_MEDIA = IS_ANDROID ? 1000 : 350;
const INTERSECTION_MARGIN_FOR_MEDIA = IS_MOBILE_SCREEN ? 300 : 500;
const FOCUSING_DURATION = 1000;
const BOTTOM_FOCUS_MARGIN = 20;
const SELECT_MODE_ANIMATION_DURATION = 200;
const FOCUSING_FADE_ANIMATION_DURATION = 200;
const UNREAD_DIVIDER_CLASS = 'unread-divider';

const runDebouncedForScroll = debounce((cb) => cb(), SCROLL_DEBOUNCE, false);
const runThrottledOnTickEnd = throttleWithTickEnd((cb) => cb());

const MessageList: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  threadId,
  type,
  hasTools,
  onFabToggle,
  isChatLoaded,
  isChannelChat,
  canPost,
  bottomOffset,
  isChatWithSelf,
  messageIds,
  messagesById,
  firstUnreadId,
  isViewportNewest,
  threadFirstMessageId,
  isRestricted,
  restrictionReason,
  focusingId,
  isSelectModeActive,
  animationLevel,
  loadViewportMessages,
  markMessageListRead,
  markMessagesRead,
  setScrollOffset,
  lastMessage,
  botDescription,
  threadTopMessageId,
  hasLinkedChat,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollOffsetRef = useRef<number>();
  const anchorIdRef = useRef<string>();
  const anchorTopRef = useRef<number>();
  const listItemElementsRef = useRef<HTMLDivElement[]>();
  // Updated when opening chat (to preserve divider even after messages are read)
  const memoUnreadDividerBeforeIdRef = useRef<number>();
  // Updated every time (to be used from intersection callback closure)
  const memoFirstUnreadIdRef = useRef<number>();
  const memoFocusingIdRef = useRef<number>();
  const isScrollTopJustUpdatedRef = useRef(false);

  const [containerHeight, setContainerHeight] = useState<number | undefined>();
  const [hasFocusing, setHasFocusing] = useState<boolean>(Boolean(focusingId));

  useOnChange(() => {
    anchorIdRef.current = undefined;

    memoUnreadDividerBeforeIdRef.current = firstUnreadId;

    // We update local cached `scrollOffsetRef` when opening chat.
    // Then we update global version every second on scrolling.
    scrollOffsetRef.current = (type === 'thread' && selectScrollOffset(getGlobal(), chatId, threadId)) || 0;
  }, [Boolean(messageIds)]);

  useOnChange(() => {
    memoFirstUnreadIdRef.current = firstUnreadId;
  }, [firstUnreadId]);

  const {
    observe: observeIntersectionForMedia, freeze: freezeForMedia, unfreeze: unfreezeForMedia,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
    margin: INTERSECTION_MARGIN_FOR_MEDIA,
  });

  const {
    observe: observeIntersectionForReading, freeze: freezeForReading, unfreeze: unfreezeForReading,
  } = useIntersectionObserver({
    rootRef: containerRef,
  }, (entries) => {
    if (type !== 'thread') {
      return;
    }

    let maxId = 0;
    const mentionIds: number[] = [];

    entries.forEach((entry) => {
      const { isIntersecting, target } = entry;

      if (!isIntersecting) {
        return;
      }

      const { dataset } = target as HTMLDivElement;

      const messageId = Number(dataset.lastMessageId || dataset.messageId);
      if (messageId > maxId) {
        maxId = messageId;
      }

      if (dataset.hasUnreadMention) {
        mentionIds.push(messageId);
      }
    });

    if (memoFirstUnreadIdRef.current && maxId >= memoFirstUnreadIdRef.current) {
      markMessageListRead({ maxId });
    }

    if (mentionIds.length) {
      markMessagesRead({ messageIds: mentionIds });
    }
  });

  useOnChange(() => {
    memoFocusingIdRef.current = focusingId;

    if (focusingId) {
      freezeForMedia();
      freezeForReading();
    } else {
      unfreezeForReading();
      unfreezeForMedia();
    }
  }, [focusingId]);

  const { observe: observeIntersectionForAnimatedStickers } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
  });

  useEffect(() => {
    if (focusingId) {
      setHasFocusing(true);
    } else {
      setTimeout(() => {
        setHasFocusing(false);
      }, FOCUSING_FADE_ANIMATION_DURATION);
    }
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

    const listedMessages = viewportIds.map((id) => messagesById[id]);
    return groupMessages(orderBy(listedMessages, ['date', 'id']), memoUnreadDividerBeforeIdRef.current);
  }, [messageIds, messagesById, threadFirstMessageId, threadTopMessageId]);

  const [loadMoreBackwards, loadMoreForwards, loadMoreAround] = useMemo(
    () => (type === 'thread' ? [
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Backwards }), 1000, true, false),
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Forwards }), 1000, true, false),
      debounce(() => loadViewportMessages({ direction: LoadMoreDirection.Around }), 1000, true, false),
    ] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadViewportMessages, messageIds],
  );

  const { isScrolled, updateStickyDates } = useStickyDates();

  const handleScroll = useCallback(() => {
    if (isScrollTopJustUpdatedRef.current) {
      isScrollTopJustUpdatedRef.current = false;
      return;
    }

    const container = containerRef.current!;

    updateStickyDates(container, hasTools);

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

  // Workaround for an iOS bug when animated stickers sometimes disappear
  useLayoutEffect(() => {
    if (!IS_IOS) {
      return;
    }

    runThrottledOnTickEnd(() => {
      if (!(containerRef.current as HTMLDivElement).querySelector('.AnimatedSticker.is-playing')) {
        return;
      }

      const style = (containerRef.current as HTMLDivElement).style as any;
      style.webkitOverflowScrolling = style.webkitOverflowScrolling === 'auto' ? '' : 'auto';
    });
  });

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
    if (isAtBottom && hasLastMessageChanged && !hasFirstMessageChanged) {
      if (lastItemElement) {
        fastRaf(() => {
          fastSmoothScroll(container, lastItemElement, 'end', BOTTOM_FOCUS_MARGIN);
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
      newScrollTop = scrollHeight - offsetHeight;
    } else if (anchor) {
      const newAnchorTop = anchor.getBoundingClientRect().top;
      newScrollTop = scrollTop + (newAnchorTop - (anchorTopRef.current || 0));
    } else if (unreadDivider) {
      newScrollTop = unreadDivider.offsetTop - (hasTools ? UNREAD_DIVIDER_TOP_WITH_TOOLS : UNREAD_DIVIDER_TOP);
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
  }, [messageIds, isViewportNewest, containerHeight, hasTools]);

  useEffect(() => {
    if (!animationLevel || animationLevel > 0) {
      dispatchHeavyAnimationEvent(SELECT_MODE_ANIMATION_DURATION + ANIMATION_END_DELAY);
    }
  }, [animationLevel, isSelectModeActive]);

  const lang = useLang();

  const isPrivate = Boolean(chatId && isChatPrivate(chatId));
  const withUsers = Boolean((!isPrivate && !isChannelChat) || isChatWithSelf);

  const className = buildClassName(
    'MessageList custom-scroll',
    !withUsers && 'no-avatars',
    isChannelChat && 'no-avatars',
    (!canPost || bottomOffset !== 'none') && 'bottom-padding',
    (bottomOffset !== 'none') && `bottom-padding-${bottomOffset}`,
    isSelectModeActive && 'select-mode-active',
    hasFocusing && 'has-focusing',
    isScrolled && 'scrolled',
  );

  return (
    <div ref={containerRef} className={className} onScroll={handleScroll}>
      {isRestricted ? (
        <div className="empty">
          <span>
            {restrictionReason ? restrictionReason.text : `This is a private ${isChannelChat ? 'channel' : 'chat'}`}
          </span>
        </div>
      ) : botDescription ? (
        <div className="empty rich"><span>{renderText(lang(botDescription), ['br', 'emoji', 'links'])}</span></div>
      ) : messageIds && messageGroups ? (
        // @ts-ignore
        <MessageScroll
          containerRef={containerRef}
          className="messages-container"
          messageIds={messageIds}
          containerHeight={containerHeight}
          listItemElementsRef={listItemElementsRef}
          focusingId={focusingId}
          anchorIdRef={anchorIdRef}
          anchorTopRef={anchorTopRef}
          loadMoreForwards={loadMoreForwards}
          loadMoreBackwards={loadMoreBackwards}
          isViewportNewest={isViewportNewest}
          firstUnreadId={firstUnreadId}
          onFabToggle={onFabToggle}
        >
          {messageGroups && renderMessages(
            lang,
            messageGroups,
            observeIntersectionForReading,
            observeIntersectionForMedia,
            observeIntersectionForAnimatedStickers,
            withUsers,
            anchorIdRef,
            memoUnreadDividerBeforeIdRef,
            threadId,
            type,
            threadTopMessageId,
            threadFirstMessageId,
            hasLinkedChat,
            type === 'scheduled',
          )}
        </MessageScroll>
      ) : messageIds ? (
        <div className="empty"><span>{lang('NoMessages')}</span></div>
      ) : lastMessage ? (
        <div className="messages-container">
          {renderMessages(
            lang,
            groupMessages([lastMessage]),
            observeIntersectionForReading,
            observeIntersectionForMedia,
            observeIntersectionForAnimatedStickers,
            withUsers,
            anchorIdRef,
            memoUnreadDividerBeforeIdRef,
            threadId,
            type,
            threadTopMessageId,
            threadFirstMessageId,
            hasLinkedChat,
            false,
          )}
        </div>
      ) : (
        <Loading color="white" />
      )}
    </div>
  );
};

function renderMessages(
  lang: LangFn,
  messageGroups: MessageDateGroup[],
  observeIntersectionForReading: ObserveFn,
  observeIntersectionForMedia: ObserveFn,
  observeIntersectionForAnimatedStickers: ObserveFn,
  withUsers: boolean,
  currentAnchorIdRef: { current: string | undefined },
  memoFirstUnreadIdRef: { current: number | undefined },
  threadId: number,
  type: MessageListType,
  threadTopMessageId?: number,
  threadFirstMessageId?: number,
  hasLinkedChat?: boolean,
  isSchedule = false,
) {
  const unreadDivider = (
    <div className={buildClassName(UNREAD_DIVIDER_CLASS, 'local-action-message')} key="unread-messages">
      <span>{lang('UnreadMessages')}</span>
    </div>
  );

  const dateGroups = messageGroups.map((
    dateGroup: MessageDateGroup,
    dateGroupIndex: number,
    dateGroupsArray: MessageDateGroup[],
  ) => {
    const senderGroups = dateGroup.senderGroups.map((
      senderGroup,
      senderGroupIndex,
      senderGroupsArray,
    ) => {
      if (senderGroup.length === 1 && !isAlbum(senderGroup[0]) && isActionMessage(senderGroup[0])) {
        const message = senderGroup[0];

        return compact([
          message.id === memoFirstUnreadIdRef.current && unreadDivider,
          <ActionMessage
            key={message.id}
            message={message}
            observeIntersection={observeIntersectionForReading}
          />,
        ]);
      }

      let currentDocumentGroupId: string | undefined;

      return flatten(senderGroup.map((
        messageOrAlbum,
        messageIndex,
      ) => {
        const message = isAlbum(messageOrAlbum) ? messageOrAlbum.mainMessage : messageOrAlbum;
        const album = isAlbum(messageOrAlbum) ? messageOrAlbum : undefined;
        const isOwn = isOwnMessage(message);
        const isMessageAlbum = isAlbum(messageOrAlbum);
        const nextMessage = senderGroup[messageIndex + 1];

        if (message.previousLocalId && currentAnchorIdRef.current === `message${message.previousLocalId}`) {
          currentAnchorIdRef.current = `message${message.id}`;
        }

        const documentGroupId = !isMessageAlbum && message.groupedId ? message.groupedId : undefined;
        const nextDocumentGroupId = nextMessage && !isAlbum(nextMessage) ? nextMessage.groupedId : undefined;

        const position = {
          isFirstInGroup: messageIndex === 0,
          isLastInGroup: messageIndex === senderGroup.length - 1,
          isFirstInDocumentGroup: Boolean(documentGroupId && documentGroupId !== currentDocumentGroupId),
          isLastInDocumentGroup: Boolean(documentGroupId && documentGroupId !== nextDocumentGroupId),
          isLastInList: (
            messageIndex === senderGroup.length - 1
            && senderGroupIndex === senderGroupsArray.length - 1
            && dateGroupIndex === dateGroupsArray.length - 1
          ),
        };

        currentDocumentGroupId = documentGroupId;

        const shouldRenderUnreadDivider = (
          (message.id === memoFirstUnreadIdRef.current && memoFirstUnreadIdRef.current !== threadFirstMessageId)
          || (message.id === threadTopMessageId && memoFirstUnreadIdRef.current === threadFirstMessageId)
        );
        const originalId = getMessageOriginalId(message);
        // Scheduled messages can have local IDs in the middle of the list,
        // and keys should be ordered, so we prefix it with a date.
        // However, this may lead to issues if server date is not synchronized with the local one.
        const key = type !== 'scheduled' ? originalId : `${message.date}_${originalId}`;

        return compact([
          shouldRenderUnreadDivider && unreadDivider,
          <Message
            key={key}
            message={message}
            observeIntersectionForBottom={observeIntersectionForReading}
            observeIntersectionForMedia={observeIntersectionForMedia}
            observeIntersectionForAnimatedStickers={observeIntersectionForAnimatedStickers}
            album={album}
            withAvatar={position.isLastInGroup && withUsers && !isOwn && !(message.id === threadTopMessageId)}
            withSenderName={position.isFirstInGroup && withUsers && !isOwn}
            threadId={threadId}
            messageListType={type}
            noComments={hasLinkedChat === false}
            isFirstInGroup={position.isFirstInGroup}
            isLastInGroup={position.isLastInGroup}
            isFirstInDocumentGroup={position.isFirstInDocumentGroup}
            isLastInDocumentGroup={position.isLastInDocumentGroup}
            isLastInList={position.isLastInList}
          />,
          message.id === threadTopMessageId && (
            <div className="local-action-message" key="discussion-started">
              <span>{lang('DiscussionStarted')}</span>
            </div>
          ),
        ]);
      }));
    });

    return (
      <div
        className="message-date-group"
        key={dateGroup.datetime}
        teactFastList
      >
        <div className="sticky-date" key="date-header">
          <span>
            {isSchedule && dateGroup.originalDate === SCHEDULED_WHEN_ONLINE && (
              lang('MessageScheduledUntilOnline')
            )}
            {isSchedule && dateGroup.originalDate !== SCHEDULED_WHEN_ONLINE && (
              lang('MessageScheduledOn', formatHumanDate(dateGroup.datetime, undefined, true))
            )}
            {!isSchedule && formatHumanDate(dateGroup.datetime)}
          </span>
        </div>
        {flatten(senderGroups)}
      </div>
    );
  });

  return flatten(dateGroups);
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

    const withLastMessageWhenPreloading = (
      threadId === MAIN_THREAD_ID
      && !messageIds && !chat.unreadCount && !focusingId && lastMessage && !lastMessage.groupedId
    );

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
      canPost: getCanPostInChat(chat, threadId),
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      messageIds,
      messagesById,
      firstUnreadId: selectFirstUnreadId(global, chatId, threadId),
      isViewportNewest: type !== 'thread' || selectIsViewportNewest(global, chatId, threadId),
      threadFirstMessageId: selectFirstMessageId(global, chatId, threadId),
      focusingId,
      isSelectModeActive: selectIsInSelectMode(global),
      animationLevel: global.settings.byKey.animationLevel,
      ...(withLastMessageWhenPreloading && { lastMessage }),
      botDescription,
      threadTopMessageId,
      hasLinkedChat: chat.fullInfo && ('linkedChatId' in chat.fullInfo)
        ? Boolean(chat.fullInfo.linkedChatId)
        : undefined,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadViewportMessages',
    'markMessageListRead',
    'markMessagesRead',
    'setScrollOffset',
  ]),
)(MessageList));
