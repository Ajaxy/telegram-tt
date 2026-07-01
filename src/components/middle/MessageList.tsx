import { beginHeavyAnimation, memo, useEffect, useMemo, useRef, useState, useUnmountCleanup } from '@teact';
import { addExtraClass, removeExtraClass } from '@teact/teact-dom';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFullInfo, ApiMessage, ApiRestrictionReason, ApiTopic } from '../../api/types';
import type { OnIntersectPinnedMessage } from './hooks/usePinnedMessage';
import { MAIN_THREAD_ID } from '../../api/types';
import { LoadMoreDirection, type MessageListType, type ThreadId } from '../../types';

import {
  ANIMATION_END_DELAY,
  ANONYMOUS_USER_ID,
  IS_PERF,
  MESSAGE_LIST_SLICE,
  SCROLL_MAX_DURATION,
  SERVICE_NOTIFICATIONS_USER_ID,
} from '../../config';
import { forceMeasure, requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import {
  getIsSavedDialog,
  getMessageHtmlId,
  getMessageOriginalId,
  isAnonymousForwardsChat,
  isChatChannel,
  isChatGroup,
  isChatMonoforum,
  isSystemBot,
} from '../../global/helpers';
import {
  selectBot,
  selectCanTranslateChat,
  selectChat,
  selectChatFullInfo,
  selectChatLastMessage,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentMessageIds,
  selectFirstUnreadId,
  selectFocusedMessageId,
  selectIsChatProtected,
  selectIsChatWithSelf,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectIsInSelectMode,
  selectIsViewportNewest,
  selectMonoforumChannel,
  selectPerformanceSettingsValue,
  selectTabState,
  selectTopic,
  selectTranslationLanguage,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { selectIsChatRestricted } from '../../global/selectors/chats';
import { selectActiveRestrictionReasons, selectCurrentMessageList } from '../../global/selectors/messages';
import {
  selectLastScrollOffset,
  selectScrollOffset,
  selectThreadInfo,
  selectThreadReadState,
} from '../../global/selectors/threads';
import animateScroll, { isAnimatingScroll, restartCurrentScrollAnimation } from '../../util/animateScroll';
import { IS_FIREFOX } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { isUserId } from '../../util/entities/ids';
import { orderBy } from '../../util/iteratees';
import { isLocalMessageId } from '../../util/keys/messageKey';
import resetScroll from '../../util/resetScroll';
import { debounce, onTickEnd } from '../../util/schedulers';
import { getServerTime } from '../../util/serverTime';
import getOffsetToContainer from '../../util/visibility/getOffsetToContainer';
import { REM } from '../common/helpers/mediaDimensions';
import { groupMessages } from './helpers/groupMessages';
import { requestMessageListReflow } from './helpers/messageListReflow';
import {
  applyMessageListBottomInset,
  getMessageListBottomReserve,
  getMessageListTopReserve,
  syncMessageListBottomReserve,
} from './helpers/messageListReserves';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

import useInterval from '../../hooks/schedulers/useInterval';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useNativeCopySelectedMessages from '../../hooks/useNativeCopySelectedMessages';
import usePrevious from '../../hooks/usePrevious';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import { isBackgroundModeActive } from '../../hooks/window/useBackgroundMode';
import useContainerHeight from './hooks/useContainerHeight';
import useStickyDates from './hooks/useStickyDates';

import Loading from '../ui/Loading';
import Transition from '../ui/Transition';
import ContactGreeting from './ContactGreeting';
import MessageListAccountInfo from './MessageListAccountInfo';
import MessageListContent from './MessageListContent';
import NoMessages from './NoMessages';
import RequirementToContactMessage from './RequirementToContactMessage';

import './MessageList.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  type: MessageListType;
  isComments?: boolean;
  canPost: boolean;
  hasFooter: boolean;
  isReady: boolean;
  withBottomShift?: boolean;
  withDefaultBg: boolean;
  isContactRequirePremium?: boolean;
  paidMessagesStars?: number;
  isQuickPreview?: boolean;
  onScrollDownToggle?: BooleanToVoidFunction;
  onIntersectPinnedMessage?: OnIntersectPinnedMessage;
};

type StateProps = {
  isChatLoaded?: boolean;
  isChannelChat?: boolean;
  isGroupChat?: boolean;
  isChatMonoforum?: boolean;
  isChatWithSelf?: boolean;
  isSystemBotChat?: boolean;
  isAnonymousForwards?: boolean;
  isCreator?: boolean;
  isChannelWithAvatars?: boolean;
  isBot?: boolean;
  isNonContact?: boolean;
  nameChangeDate?: number;
  photoChangeDate?: number;
  isSynced?: boolean;
  messageIds?: number[];
  messagesById?: Record<number, ApiMessage>;
  firstUnreadId?: number;
  isViewportNewest?: boolean;
  isRestricted?: boolean;
  restrictionReasons?: ApiRestrictionReason[];
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
  isAccountFrozen?: boolean;
  areAdsEnabled?: boolean;
  channelJoinInfo?: ApiChatFullInfo['joinInfo'];
  isChatProtected?: boolean;
  hasCustomGreeting?: boolean;
  isAppConfigLoaded?: boolean;
  monoforumChannelId?: string;
  canTranslate?: boolean;
  translationLanguage?: string;
  shouldAutoTranslate?: boolean;
  isActive?: boolean;
  canManageBotForumTopics?: boolean;
  shouldScrollToBottom?: boolean;
  reactionPollingPause?: { until: number; chatId: string };
};

enum Content {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Loading,
  Restricted,
  StarsRequired,
  PremiumRequired,
  AccountInfo,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  ContactGreeting,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  NoMessages,
  MessageList,
}

const MESSAGE_REACTIONS_POLLING_INTERVAL = 20 * 1000;
const MESSAGE_COMMENTS_POLLING_INTERVAL = 20 * 1000;
const MESSAGE_FACT_CHECK_UPDATE_INTERVAL = 5 * 1000;
const MESSAGE_STORY_POLLING_INTERVAL = 5 * 60 * 1000;

const BOTTOM_THRESHOLD = 50;
const BOTTOM_SNAP_THRESHOLD = 7;

const UNREAD_DIVIDER_TOP = 10;
const SCROLL_DEBOUNCE = 200;
const MESSAGE_ANIMATION_DURATION = 500;
const SEND_FOCUS_DURATION = SCROLL_MAX_DURATION + ANIMATION_END_DELAY;
const BOTTOM_FOCUS_MARGIN = 0.5 * REM;
const FEW_MESSAGES_SCROLL_RISE = 4 * REM;
const SELECT_MODE_ANIMATION_DURATION = 200;

const UNREAD_DIVIDER_CLASS = 'unread-divider';
const FORCE_MESSAGES_SCROLL_CLASS = 'force-messages-scroll';
const BOTTOM_SNAP_CLASS = 'with-bottom-snap';

const runDebouncedForScroll = debounce((cb) => cb(), SCROLL_DEBOUNCE, false);

function getShouldReleaseLiveTail(liveTailElement: HTMLDivElement) {
  const liveTailMinHeight = parseFloat(getComputedStyle(liveTailElement).minHeight);

  return Boolean(liveTailMinHeight && liveTailElement.scrollHeight > liveTailMinHeight + 1);
}

const MessageList = ({
  chatId,
  threadId,
  type,
  isChatLoaded,
  isForum,
  isChannelChat,
  isGroupChat,
  isChannelWithAvatars,
  canPost,
  hasFooter,
  isSynced,
  isActive,
  canManageBotForumTopics,
  shouldScrollToBottom,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  isChatMonoforum,
  isReady,
  isChatWithSelf,
  isSystemBotChat,
  isAnonymousForwards,
  isCreator,
  isBot,
  isNonContact,
  nameChangeDate,
  photoChangeDate,
  messageIds,
  messagesById,
  firstUnreadId,
  isComments,
  isViewportNewest,
  isRestricted,
  restrictionReasons,
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
  paidMessagesStars,
  areAdsEnabled,
  channelJoinInfo,
  isChatProtected,
  isAccountFrozen,
  hasCustomGreeting,
  monoforumChannelId,
  isAppConfigLoaded,
  canTranslate,
  translationLanguage,
  shouldAutoTranslate,
  reactionPollingPause,
  isQuickPreview,
  onIntersectPinnedMessage,
  onScrollDownToggle,
}: OwnProps & StateProps) => {
  const {
    loadViewportMessages, setScrollOffset, loadSponsoredMessages, loadMessageReactions, copyMessagesByIds,
    loadMessageViews, loadPeerStoriesByIds, loadFactChecks, requestChatTranslation,
  } = getActions();

  const containerRef = useRef<HTMLDivElement>();

  // We update local cached `scrollOffsetRef` when opening chat.
  // Then we update global version every second on scrolling.
  const scrollOffsetRef = useRef<number>(
    (type === 'thread' && (
      selectScrollOffset(getGlobal(), chatId, threadId)
      || selectLastScrollOffset(getGlobal(), chatId, threadId)
    ))
    || 0,
  );

  const anchorIdRef = useRef<string>();
  const anchorTopRef = useRef<number>();
  const listItemElementsRef = useRef<HTMLDivElement[]>();
  const memoFirstUnreadIdRef = useRef<number>();
  const memoUnreadDividerBeforeIdRef = useRef<number | undefined>();
  const memoFocusingIdRef = useRef<number>();
  const isScrollTopJustUpdatedRef = useRef(false);
  // Suppresses spurious load-more triggers caused by Safari delivering stale
  // `IntersectionObserver` entries between DOM mutation and scroll restore
  const isReplacingHistoryRef = useRef(false);
  const shouldAnimateAppearanceRef = useRef(Boolean(lastMessage));
  const scrollSnapDisabledTimerRef = useRef<number>();
  const isLiveTailBottomSnapSuppressedRef = useRef(false);
  const isLiveTailAutoScrollingRef = useRef(false);
  const liveTailReleaseTimerRef = useRef<number>();
  const liveTailStartOriginalIdRef = useRef<number>();
  const scrollTopBeforeUpdateRef = useRef<number>();
  const [releasedLiveTailStartOriginalId, setReleasedLiveTailStartOriginalId] = useState<number>();

  const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);
  const hasOpenChatButton = isSavedDialog
    && threadId !== ANONYMOUS_USER_ID
    && threadId !== currentUserId;

  const areMessagesLoaded = Boolean(messageIds);

  const isPrivate = isUserId(chatId);
  const withUsers = Boolean((!isPrivate && !isChannelChat)
    || isChatWithSelf || isSystemBotChat || isAnonymousForwards || isChannelWithAvatars);

  const liveTailStartOriginalId = useMemo(() => {
    if (!messageIds?.length || !messagesById) {
      return undefined;
    }

    const previousLiveTailStartOriginalId = liveTailStartOriginalIdRef.current;
    const hasActiveLiveTail = previousLiveTailStartOriginalId !== undefined
      && previousLiveTailStartOriginalId !== releasedLiveTailStartOriginalId;
    let renderedLiveTailStartOriginalId: number | undefined;

    for (let i = messageIds.length - 1; i >= 0; i--) {
      const message = messagesById[messageIds[i]];
      if (!message) {
        continue;
      }

      const originalId = getMessageOriginalId(message);
      if (
        hasActiveLiveTail
        && message.isOutgoing
        && originalId >= previousLiveTailStartOriginalId
      ) {
        return originalId;
      }

      if (message.isTypingDraft && !message.isOutgoing) {
        if (
          hasActiveLiveTail
          && originalId === previousLiveTailStartOriginalId
        ) {
          renderedLiveTailStartOriginalId = previousLiveTailStartOriginalId;
          continue;
        }

        if (hasActiveLiveTail) {
          continue;
        }

        // Start new live tail from our message to keep consistency with in-tail focusing
        const previousMessage = i > 0 ? messagesById[messageIds[i - 1]] : undefined;
        if (previousMessage?.isOutgoing) {
          return getMessageOriginalId(previousMessage);
        }

        return originalId;
      }

      if (
        previousLiveTailStartOriginalId !== undefined
        && message.wasTypingDraft
        && originalId === previousLiveTailStartOriginalId
      ) {
        renderedLiveTailStartOriginalId = previousLiveTailStartOriginalId;
      }
    }

    return renderedLiveTailStartOriginalId;
  }, [messageIds, messagesById, releasedLiveTailStartOriginalId]);

  liveTailStartOriginalIdRef.current = liveTailStartOriginalId;

  const effectiveLiveTailStartOriginalId = liveTailStartOriginalId !== releasedLiveTailStartOriginalId
    ? liveTailStartOriginalId
    : undefined;

  useUnmountCleanup(() => {
    clearTimeout(liveTailReleaseTimerRef.current);
  });

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
    if (areAdsEnabled && canHaveAds && isSynced && isReady && isAppConfigLoaded) {
      loadSponsoredMessages({ peerId: chatId });
    }
  }, [chatId, isSynced, isReady, isChannelChat, isBot, areAdsEnabled, isAppConfigLoaded]);

  // Updated only once when messages are loaded (as we want the unread divider to keep its position)
  useSyncEffect(() => {
    if (areMessagesLoaded) {
      memoUnreadDividerBeforeIdRef.current = memoFirstUnreadIdRef.current;
    }
  }, [areMessagesLoaded]);

  useSyncEffect(() => {
    memoFocusingIdRef.current = focusingId;
  }, [focusingId]);

  // Enable auto translation for the chat if it's available
  useEffect(() => {
    if (!shouldAutoTranslate || !canTranslate) return;
    requestChatTranslation({ chatId, toLanguageCode: translationLanguage });
  }, [shouldAutoTranslate, canTranslate, translationLanguage, chatId]);

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
              mediaType: 'action',
              type: 'channelJoined',
              inviterId: channelJoinInfo?.inviterId,
              isViaRequest: channelJoinInfo?.isViaRequest || undefined,
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
        withUsers,
        effectiveLiveTailStartOriginalId,
      )
      : undefined;
  }, [withUsers,
    messageIds, messagesById, type,
    isServiceNotificationsChat, isForum,
    threadId, isChatWithSelf, channelJoinInfo, effectiveLiveTailStartOriginalId]);

  const currentLastMessageId = messageIds?.[messageIds.length - 1];
  const currentLastMessage = currentLastMessageId !== undefined ? messagesById?.[currentLastMessageId] : undefined;
  const currentLastMessageOriginalId = currentLastMessage
    ? getMessageOriginalId(currentLastMessage)
    : currentLastMessageId;
  const isCurrentLastMessageTypingDraft = Boolean(
    currentLastMessage?.isTypingDraft || currentLastMessage?.wasTypingDraft,
  );
  const isCurrentLastMessageIncomingTypingDraft = Boolean(
    currentLastMessage?.isTypingDraft && !currentLastMessage.isOutgoing,
  );

  useInterval(() => {
    if (!messageIds || !messagesById || type === 'scheduled' || isAccountFrozen || !isActive) return;
    if (!isChannelChat && !isGroupChat) return;
    if (reactionPollingPause?.chatId === chatId && reactionPollingPause.until > getServerTime()) return;

    const ids = messageIds.filter((id) => {
      const message = messagesById[id];
      return message && message.reactions && !message.content.action;
    });

    if (!ids.length) return;

    loadMessageReactions({ chatId, ids });
  }, MESSAGE_REACTIONS_POLLING_INTERVAL);

  useInterval(() => {
    if (!messageIds || !messagesById || type === 'scheduled' || !isActive) {
      return;
    }
    const storyDataList = messageIds.map((id) => messagesById[id]?.content.storyData).filter(Boolean);

    if (!storyDataList.length) return;

    const storiesByPeerIds = storyDataList.reduce((acc, storyData) => {
      const { peerId, id } = storyData;
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
    if (!messageIds || !messagesById || threadId !== MAIN_THREAD_ID || type === 'scheduled' || !isActive) {
      return;
    }
    const global = getGlobal();
    const ids = messageIds.filter((id) => selectThreadInfo(global, chatId, id)?.isCommentsInfo
      || messagesById[id]?.viewsCount !== undefined);

    if (!ids.length) return;

    loadMessageViews({ chatId, ids });
  }, MESSAGE_COMMENTS_POLLING_INTERVAL, true);

  useInterval(() => {
    if (!messageIds || !messagesById || threadId !== MAIN_THREAD_ID || type === 'scheduled' || !isActive) {
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

    return debounce(
      () => loadViewportMessages({ direction: LoadMoreDirection.Around, chatId, threadId }),
      1000,
      true,
      false,
    );
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [loadViewportMessages, messageIds]);

  const { isScrolled, updateStickyDates } = useStickyDates();

  const updateBottomSnapClass = useLastCallback(() => {
    const container = containerRef.current;
    const bottomTrigger = container?.querySelector<HTMLDivElement>('.fab-trigger');
    if (!container || !bottomTrigger) return;

    if (effectiveLiveTailStartOriginalId !== undefined && isLiveTailBottomSnapSuppressedRef.current) {
      requestMutation(() => {
        removeExtraClass(container, BOTTOM_SNAP_CLASS);
      });
      return;
    }

    // Check if fab-trigger + threshold are entering the viewport
    const viewportBottom = container.scrollTop + container.offsetHeight;
    const triggerPosition = bottomTrigger.offsetTop;
    // Scroll is near fab-trigger + threshold. Prevents snap on sponsored message
    const shouldSnapBeActive = triggerPosition - BOTTOM_SNAP_THRESHOLD <= viewportBottom
      && viewportBottom <= triggerPosition + BOTTOM_SNAP_THRESHOLD * 2;

    const hasSnap = container.classList.contains(BOTTOM_SNAP_CLASS);
    if (hasSnap === shouldSnapBeActive) return;

    if (shouldSnapBeActive) {
      requestMutation(() => {
        addExtraClass(container, BOTTOM_SNAP_CLASS);
      });
    } else {
      clearTimeout(scrollSnapDisabledTimerRef.current);
      scrollSnapDisabledTimerRef.current = undefined;
      requestMutation(() => {
        removeExtraClass(container, BOTTOM_SNAP_CLASS);
      });
    }
  });

  const allowLiveTailBottomSnap = useLastCallback(() => {
    if (effectiveLiveTailStartOriginalId === undefined || !isLiveTailBottomSnapSuppressedRef.current) {
      return;
    }

    isLiveTailBottomSnapSuppressedRef.current = false;
    updateBottomSnapClass();
  });

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

    if (isLiveTailAutoScrollingRef.current) {
      if (!isAnimatingScroll()) {
        requestMeasure(() => {
          isLiveTailAutoScrollingRef.current = false;
        });
      }
    } else {
      allowLiveTailBottomSnap();
    }

    // Check if scroll should be snapped, but only if there's no new message animation in progress
    if (scrollSnapDisabledTimerRef.current === undefined) {
      updateBottomSnapClass();
    }

    runDebouncedForScroll(() => {
      const global = getGlobal();

      const isFocusing = Boolean(selectTabState(global).focusedMessage?.chatId);
      if (!isFocusing) {
        onIntersectPinnedMessage?.({ shouldCancelWaiting: true });
      }

      if (!container.parentElement) {
        return;
      }

      scrollOffsetRef.current = container.scrollHeight - container.scrollTop;

      if (type === 'thread' && !isQuickPreview) {
        setScrollOffset({ chatId, threadId, scrollOffset: scrollOffsetRef.current });
      }
    });
  });

  const isMessageSendPendingRef = useRef(false);

  const handleContentResize = useLastCallback((growth: number) => {
    const container = containerRef.current;
    if (!container || growth <= 0) return;

    requestMeasure(() => {
      if (
        isMessageSendPendingRef.current
        || isAnimatingScroll()
        || isLiveTailAutoScrollingRef.current
        || isScrollTopJustUpdatedRef.current
        || isReplacingHistoryRef.current
      ) {
        return;
      }

      const { scrollTop, scrollHeight, offsetHeight } = container;
      const wasAtBottom = (scrollHeight - scrollTop - offsetHeight) - growth <= BOTTOM_THRESHOLD;
      if (!wasAtBottom || !isViewportNewest) return;

      requestMutation(() => {
        resetScroll(container, scrollHeight - offsetHeight);
        scrollOffsetRef.current = offsetHeight;
        isScrollTopJustUpdatedRef.current = true;
        requestMeasure(() => {
          isScrollTopJustUpdatedRef.current = false;
        });
      });
    });
  });

  const [getContainerHeight, prevContainerHeightRef] = useContainerHeight(containerRef, canPost && !isSelectModeActive);

  const handleWheel = useLastCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY > 0) {
      isLiveTailAutoScrollingRef.current = false;
      allowLiveTailBottomSnap();
    }

    // Remove snap when scrolling up to avoid scroll bug
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1753188
    if (IS_FIREFOX && e.deltaY < 0) {
      const container = containerRef.current;
      if (!container) return;

      requestMutation(() => {
        removeExtraClass(container, BOTTOM_SNAP_CLASS);
      });
    }
  });

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
    () => {
      isReplacingHistoryRef.current = true;
      forceMeasure(() => {
        scrollTopBeforeUpdateRef.current = containerRef.current?.scrollTop;
        rememberScrollPositionRef.current();
      });
    },
    // This will run before modifying content and should match deps for `useLayoutEffectWithPrevDeps` below
    [messageIds, isViewportNewest, effectiveLiveTailStartOriginalId, rememberScrollPositionRef],
  );
  useEffect(
    () => rememberScrollPositionRef.current(),
    // This is only needed to react on signal updates
    [getContainerHeight, rememberScrollPositionRef],
  );

  /* Handles updated message list, takes care of scroll repositioning
    Live tail mode:
    - When a new typing draft is received, the live tail is revealed
    - New messages attach to it. New outgoing message kick older out
    - If outgoing message is tall, we should show at least one line of typing draft that replies to it
  */
  useLayoutEffectWithPrevDeps(([
    prevMessageIds, prevIsViewportNewest, prevCurrentLastMessageOriginalId, prevLiveTailStartOriginalId,
  ]) => {
    if (IS_PERF) {
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

    const hasLastMessageChanged = currentLastMessageOriginalId !== prevCurrentLastMessageOriginalId;
    const firstMessageId = messageIds?.[0];
    const prevFirstMessageId = prevMessageIds?.[0];
    const hasLoadedMessageIds = Boolean(messageIds?.length && prevMessageIds?.length);
    const hasViewportShifted = (
      firstMessageId !== prevFirstMessageId && messageIds?.length === (MESSAGE_LIST_SLICE / 2 + 1)
    );

    const wasMessageAdded = hasLoadedMessageIds && hasLastMessageChanged && !hasViewportShifted;
    const wasLiveTailCreated = Boolean(
      effectiveLiveTailStartOriginalId !== undefined
      && effectiveLiveTailStartOriginalId !== prevLiveTailStartOriginalId,
    );
    const hasLiveTail = effectiveLiveTailStartOriginalId !== undefined;
    const shouldRevealLiveTailTypingDraft = Boolean(
      wasMessageAdded
      && hasLiveTail
      && !wasLiveTailCreated
      && isCurrentLastMessageIncomingTypingDraft,
    );

    if (wasLiveTailCreated || shouldRevealLiveTailTypingDraft) {
      isLiveTailBottomSnapSuppressedRef.current = true;
    } else if (!hasLiveTail) {
      isLiveTailBottomSnapSuppressedRef.current = false;
    }

    const shouldReleaseLiveTail = Boolean(
      wasMessageAdded
      && currentLastMessageOriginalId !== undefined
      && hasLiveTail
      && !wasLiveTailCreated
      && !isCurrentLastMessageTypingDraft
      && forceMeasure(() => {
        const liveTailElement = container.querySelector<HTMLDivElement>('.live-tail');
        return liveTailElement ? getShouldReleaseLiveTail(liveTailElement) : false;
      }),
    );

    // Add extra height when few messages to allow scroll animation
    if (
      isViewportNewest
      && wasMessageAdded
      && !hasLiveTail
      && (messageIds && messageIds.length < MESSAGE_LIST_SLICE / 2)
      && !container.parentElement!.classList.contains(FORCE_MESSAGES_SCROLL_CLASS)
      && forceMeasure(() => (
        (container.firstElementChild as HTMLDivElement).clientHeight <= container.offsetHeight * 2
      ))
    ) {
      addExtraClass(container.parentElement!, FORCE_MESSAGES_SCROLL_CLASS);

      setTimeout(() => {
        requestMutation(() => {
          if (container.parentElement) {
            removeExtraClass(container.parentElement, FORCE_MESSAGES_SCROLL_CLASS);
          }
        });
      }, MESSAGE_ANIMATION_DURATION);
    }

    if (wasMessageAdded) {
      isMessageSendPendingRef.current = true;
      clearTimeout(scrollSnapDisabledTimerRef.current);
      scrollSnapDisabledTimerRef.current = undefined;

      removeExtraClass(container, BOTTOM_SNAP_CLASS);

      scrollSnapDisabledTimerRef.current = window.setTimeout(() => {
        scrollSnapDisabledTimerRef.current = undefined;
        isMessageSendPendingRef.current = false;
        updateBottomSnapClass();
      }, MESSAGE_ANIMATION_DURATION);
    }

    requestMessageListReflow(() => {
      const { scrollTop, scrollHeight, offsetHeight } = container;
      const scrollOffset = scrollOffsetRef.current;
      const bottomReserve = getMessageListBottomReserve(container);
      const messagesContainerEl = container.querySelector<HTMLElement>('.messages-container');
      const currentBottomInset = messagesContainerEl
        ? parseFloat(getComputedStyle(messagesContainerEl).paddingBottom) || 0
        : 0;
      const reserveDelta = bottomReserve - currentBottomInset;
      const effectiveScrollHeight = scrollHeight + reserveDelta;

      let bottomOffset = scrollOffset - (prevContainerHeight || offsetHeight);
      const lastItemHeight = wasMessageAdded && lastItemElement ? lastItemElement.offsetHeight : 0;
      if (wasMessageAdded) {
        // If two new messages come at once (e.g. when bot responds) then the first message will update `scrollOffset`
        // right away (before animation) which creates inconsistency until the animation completes. To work around that,
        // we calculate `isAtBottom` with a "buffer" of the latest message height (this is approximate).
        bottomOffset -= lastItemHeight;
      }
      const isAtBottom = isViewportNewest && prevIsViewportNewest && bottomOffset <= BOTTOM_THRESHOLD;
      const wasAtBottomBeforeTypingDraft = Boolean(
        shouldRevealLiveTailTypingDraft
        && isViewportNewest
        && prevIsViewportNewest
        && scrollHeight - lastItemHeight - scrollTop - offsetHeight <= BOTTOM_THRESHOLD,
      );
      const shouldFocusLiveTail = wasLiveTailCreated && isAtBottom;
      const shouldRevealTypingDraft = Boolean(
        shouldRevealLiveTailTypingDraft
        && (isAtBottom || wasAtBottomBeforeTypingDraft),
      );

      const isAlreadyFocusing = messageIds && memoFocusingIdRef.current === messageIds[messageIds.length - 1];

      // Animate incoming message, but if app is in background mode, scroll to the first unread
      if (wasMessageAdded && isAtBottom && (!isAlreadyFocusing || shouldReleaseLiveTail) && (
        !hasLiveTail || shouldReleaseLiveTail
      )) {
        // Break out of `forceLayout`
        requestMeasure(() => {
          const isScrollToBottom = !isBackgroundModeActive() || !firstUnreadElement;
          const topReserve = getMessageListTopReserve(container);
          const isFewMessagesScroll = container.parentElement?.classList.contains(FORCE_MESSAGES_SCROLL_CLASS);
          const maxDistance = isFewMessagesScroll && isScrollToBottom
            ? FEW_MESSAGES_SCROLL_RISE
            : undefined;
          animateScroll({
            container,
            element: isScrollToBottom ? lastItemElement : firstUnreadElement,
            position: isScrollToBottom ? 'end' : 'start',
            margin: BOTTOM_FOCUS_MARGIN + (isScrollToBottom ? bottomReserve : topReserve),
            topReserve,
            bottomReserve,
            maxDistance,
            forceDuration: noMessageSendingAnimation ? 0 : undefined,
          });

          if (shouldReleaseLiveTail && effectiveLiveTailStartOriginalId !== undefined) {
            clearTimeout(liveTailReleaseTimerRef.current);

            liveTailReleaseTimerRef.current = window.setTimeout(() => {
              liveTailReleaseTimerRef.current = undefined;
              setReleasedLiveTailStartOriginalId(effectiveLiveTailStartOriginalId);
            }, SEND_FOCUS_DURATION);
          }
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
      const liveTailElement = shouldFocusLiveTail
        ? container.querySelector<HTMLDivElement>('.live-tail')
        : undefined;
      const animateLiveTailScroll = liveTailElement
        ? animateScroll({
          container,
          element: liveTailElement,
          position: 'end',
          margin: bottomReserve,
          maxDistance: Number.MAX_SAFE_INTEGER,
          forceDuration: noMessageSendingAnimation ? 0 : undefined,
          shouldReturnMutationFn: true,
        })
        : undefined;
      const typingDraftTop = shouldRevealTypingDraft && lastItemElement
        ? getOffsetToContainer(lastItemElement, container).top
        : undefined;
      const typingDraftBottom = typingDraftTop !== undefined && lastItemElement
        ? typingDraftTop + lastItemElement.offsetHeight
        : undefined;
      const scrollTopBeforeUpdate = scrollTopBeforeUpdateRef.current;
      const viewportBottomBeforeUpdate = (scrollTopBeforeUpdate ?? scrollTop) + offsetHeight;
      const typingDraftElement = typingDraftBottom !== undefined && typingDraftBottom > viewportBottomBeforeUpdate
        ? lastItemElement
        : undefined;
      const typingDraftScrollTop = typingDraftElement && typingDraftTop !== undefined
        ? typingDraftTop + typingDraftElement.offsetHeight - offsetHeight
        : undefined;
      const shouldRestoreBeforeTypingDraftAnimation = Boolean(
        typingDraftElement
        && scrollTopBeforeUpdate !== undefined
        && scrollTopBeforeUpdate < scrollTop
        && typingDraftScrollTop !== undefined
        && scrollTopBeforeUpdate < typingDraftScrollTop,
      );

      let animateTypingDraftScroll: NoneToVoidFunction | undefined;
      if (typingDraftElement) {
        animateTypingDraftScroll = shouldRestoreBeforeTypingDraftAnimation ? () => {
          resetScroll(container, scrollTopBeforeUpdate);
          requestMeasure(() => {
            const mutate = animateScroll({
              container,
              element: typingDraftElement,
              position: 'end',
              margin: bottomReserve,
              maxDistance: Number.MAX_SAFE_INTEGER,
              forceDuration: noMessageSendingAnimation ? 0 : undefined,
              shouldReturnMutationFn: true,
            });

            requestMutation(mutate!);
          });
        } : animateScroll({
          container,
          element: typingDraftElement,
          position: 'end',
          margin: bottomReserve,
          maxDistance: Number.MAX_SAFE_INTEGER,
          forceDuration: noMessageSendingAnimation ? 0 : undefined,
          shouldReturnMutationFn: true,
        });
      }

      let newScrollTop!: number;
      if (liveTailElement) {
        const liveTailOffset = getOffsetToContainer(liveTailElement, container).top;
        newScrollTop = liveTailOffset + liveTailElement.offsetHeight - offsetHeight;
      } else if (shouldFocusLiveTail) {
        newScrollTop = scrollHeight - offsetHeight;
      } else if (typingDraftScrollTop !== undefined) {
        newScrollTop = typingDraftScrollTop;
      } else if (shouldRevealTypingDraft) {
        newScrollTop = scrollTop;
      } else if (isAtBottom && isResized) {
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

      const isBottomAnchored = !liveTailElement && !shouldFocusLiveTail && typingDraftScrollTop === undefined
        && !shouldRevealTypingDraft && !anchor && !unreadDivider;
      if (isBottomAnchored) {
        newScrollTop += reserveDelta;
      }

      return () => {
        applyMessageListBottomInset(container, bottomReserve);

        const animateScrollMutation = animateLiveTailScroll || animateTypingDraftScroll;
        if (animateScrollMutation) {
          const animationStartScrollTop = shouldRestoreBeforeTypingDraftAnimation && scrollTopBeforeUpdate !== undefined
            ? scrollTopBeforeUpdate
            : scrollTop;

          if (Math.abs(newScrollTop - animationStartScrollTop) >= 1) {
            isLiveTailAutoScrollingRef.current = true;
          }

          animateScrollMutation();
          scrollOffsetRef.current = Math.max(Math.ceil(effectiveScrollHeight - newScrollTop), offsetHeight);
          requestMeasure(() => {
            isReplacingHistoryRef.current = false;
          });
          return;
        }

        resetScroll(container, Math.ceil(newScrollTop));

        requestMeasure(() => {
          isReplacingHistoryRef.current = false;
        });
        restartCurrentScrollAnimation();

        scrollOffsetRef.current = Math.max(Math.ceil(effectiveScrollHeight - newScrollTop), offsetHeight);

        if (!memoFocusingIdRef.current) {
          isScrollTopJustUpdatedRef.current = true;

          requestMeasure(() => {
            isScrollTopJustUpdatedRef.current = false;

            updateBottomSnapClass();
          });
        }

        if (IS_PERF) {
          // eslint-disable-next-line no-console
          console.timeEnd('scrollTop');
        }
      };
    });
    // This should match deps for `useSyncEffect` above
  }, [
    messageIds,
    isViewportNewest,
    currentLastMessageOriginalId,
    effectiveLiveTailStartOriginalId,
    isCurrentLastMessageTypingDraft,
    isCurrentLastMessageIncomingTypingDraft,
    getContainerHeight,
    prevContainerHeightRef,
    noMessageSendingAnimation,
  ]);

  useEffectWithPrevDeps(([prevIsSelectModeActive]) => {
    if (prevIsSelectModeActive === undefined) return;
    beginHeavyAnimation(SELECT_MODE_ANIMATION_DURATION + ANIMATION_END_DELAY);

    const container = containerRef.current;
    if (container) {
      const wasAtBottom = container.classList.contains(BOTTOM_SNAP_CLASS);
      syncMessageListBottomReserve(container, false, wasAtBottom);
    }
  }, [isSelectModeActive]);

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
    !hasFooter && 'no-footer',
    type === 'pinned' && 'type-pinned',
    withBottomShift && 'with-bottom-shift',
    withDefaultBg && 'with-default-bg',
    isSelectModeActive && 'select-mode-active',
    isScrolled && 'scrolled',
    !isReady && 'is-animating',
    hasOpenChatButton && 'saved-dialog',
    isChatProtected && 'hide-on-print',
  );

  const hasMessages = Boolean((messageIds && messageGroups) || lastMessage);

  useEffect(() => {
    if (hasMessages) return;

    onScrollDownToggle?.(false);
  }, [hasMessages, onScrollDownToggle]);

  const activeKey = isRestricted ? (
    Content.Restricted
  ) : paidMessagesStars && !hasMessages && !hasCustomGreeting ? (
    Content.StarsRequired
  ) : isContactRequirePremium && !hasMessages ? (
    Content.PremiumRequired
  ) : (isBot || isNonContact) && !hasMessages && threadId === MAIN_THREAD_ID ? (
    Content.AccountInfo
  ) : shouldRenderGreeting ? (
    Content.ContactGreeting
  ) : messageIds && (!messageGroups || isGroupChatJustCreated || isEmptyTopic) ? (
    Content.NoMessages
  ) : hasMessages ? (
    Content.MessageList
  ) : (
    Content.Loading
  );
  const previousActiveKey = usePrevious(activeKey);
  const shouldSkipContentTransition = previousActiveKey !== undefined
    && (activeKey === Content.AccountInfo || previousActiveKey === Content.AccountInfo);

  function renderContent() {
    return activeKey === Content.Restricted ? (
      <div className="empty">
        <span>
          {restrictionReasons?.[0]?.text || `This is a private ${isChannelChat ? 'channel' : 'chat'}`}
        </span>
      </div>
    ) : activeKey === Content.StarsRequired ? (
      <RequirementToContactMessage paidMessagesStars={paidMessagesStars} peerId={monoforumChannelId || chatId} />
    ) : activeKey === Content.PremiumRequired ? (
      <RequirementToContactMessage peerId={chatId} />
    ) : activeKey === Content.AccountInfo ? (
      <MessageListAccountInfo chatId={chatId} hasMessages={hasMessages} />
    ) : activeKey === Content.ContactGreeting ? (
      <ContactGreeting key={chatId} userId={chatId} />
    ) : activeKey === Content.NoMessages ? (
      <NoMessages
        chatId={chatId}
        topic={topic}
        type={type}
        isChatWithSelf={isChatWithSelf}
        isGroupChatJustCreated={isGroupChatJustCreated}
      />
    ) : activeKey === Content.MessageList ? (
      <MessageListContent
        canShowAds={areAdsEnabled && isChannelChat}
        chatId={chatId}
        isComments={isComments}
        isChannelChat={isChannelChat}
        isChatMonoforum={isChatMonoforum}
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
        liveTailStartOriginalId={effectiveLiveTailStartOriginalId}
        isReplacingHistoryRef={isReplacingHistoryRef}
        threadId={threadId}
        type={type}
        isReady={isReady}
        isActive={isActive}
        hasLinkedChat={hasLinkedChat}
        isSchedule={messageGroups ? type === 'scheduled' : false}
        shouldRenderAccountInfo={isBot || isNonContact}
        nameChangeDate={nameChangeDate}
        photoChangeDate={photoChangeDate}
        noAppearanceAnimation={!messageGroups || !shouldAnimateAppearanceRef.current}
        isQuickPreview={isQuickPreview}
        canPost={canPost}
        canManageBotForumTopics={canManageBotForumTopics}
        shouldScrollToBottom={shouldScrollToBottom}
        onScrollDownToggle={onScrollDownToggle}
        onContentResize={handleContentResize}
        onIntersectPinnedMessage={onIntersectPinnedMessage}
      />
    ) : (
      <Loading color="white" backgroundColor="dark" />
    );
  }

  return (
    <Transition
      ref={containerRef}
      className={className}
      name={shouldSkipContentTransition ? 'none' : 'fade'}
      activeKey={activeKey}
      shouldCleanup
      onScroll={handleScroll}
      onWheel={handleWheel}
      onMouseDown={preventMessageInputBlur}
    >
      {renderContent()}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId, type }): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const currentUserId = global.currentUserId!;
    const chat = selectChat(global, chatId);
    const user = selectUser(global, chatId);
    const userFullInfo = selectUserFullInfo(global, chatId);
    const readState = selectThreadReadState(global, chatId, threadId);
    if (!chat) {
      return { currentUserId } as Complete<StateProps>;
    }

    const messageIds = selectCurrentMessageIds(global, chatId, threadId, type);
    const chatMessagesById = selectChatMessages(global, chatId);
    const messagesById = type === 'scheduled'
      ? selectChatScheduledMessages(global, chatId)
      : chatMessagesById;

    const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);

    if (
      threadId !== MAIN_THREAD_ID && !isSavedDialog && !chat?.isForum
      && !(chatMessagesById && threadId && chatMessagesById[Number(threadId)])
    ) {
      return { currentUserId } as Complete<StateProps>;
    }

    const isRestricted = selectIsChatRestricted(global, chatId);
    const restrictionReasons = selectActiveRestrictionReasons(global, chat?.restrictionReasons);
    const lastMessage = type === 'thread' ? selectChatLastMessage(global, chatId, isSavedDialog ? 'saved' : 'all')
      : undefined;
    const focusingId = selectFocusedMessageId(global, chatId);

    const withLastMessageWhenPreloading = (
      threadId === MAIN_THREAD_ID
      && !messageIds && readState && !readState.unreadCount && !focusingId && lastMessage && !lastMessage.groupedId
    );

    const chatBot = selectBot(global, chatId);
    const isNonContact = Boolean(userFullInfo?.settings?.canAddContact);
    const nameChangeDate = userFullInfo?.settings?.nameChangeDate;
    const photoChangeDate = userFullInfo?.settings?.photoChangeDate;

    const topic = selectTopic(global, chatId, threadId);
    const chatFullInfo = !isUserId(chatId) ? selectChatFullInfo(global, chatId) : undefined;
    const isEmptyThread = selectThreadInfo(global, chatId, threadId)?.messagesCount === 0;

    const isCurrentUserPremium = selectIsCurrentUserPremium(global);
    const areAdsEnabled = !isCurrentUserPremium || selectUserFullInfo(global, currentUserId)?.areAdsEnabled;
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    const hasCustomGreeting = Boolean(userFullInfo?.businessIntro);
    const isAppConfigLoaded = global.isAppConfigLoaded;

    const monoforumChannelId = selectMonoforumChannel(global, chatId)?.id;
    const canTranslate = selectCanTranslateChat(global, chatId) && !chatFullInfo?.isTranslationDisabled;
    const shouldAutoTranslate = chat?.hasAutoTranslation;
    const translationLanguage = selectTranslationLanguage(global);

    const currentMessageList = selectCurrentMessageList(global);
    const isActive = currentMessageList && currentMessageList.chatId === chatId
      && currentMessageList.threadId === threadId && currentMessageList.type === type;

    const {
      chatId: focusedChatId,
      threadId: focusedThreadId,
      messageId: focusedMessageId,
    } = tabState.focusedMessage || {};
    const shouldScrollToBottom = focusedChatId === chatId && focusedThreadId === threadId && !focusedMessageId;

    return {
      isActive,
      areAdsEnabled,
      isChatLoaded: true,
      isRestricted,
      restrictionReasons,
      isChannelChat: isChatChannel(chat),
      isChatMonoforum: isChatMonoforum(chat),
      isGroupChat: isChatGroup(chat),
      isChannelWithAvatars: chat.areProfilesShown,
      isCreator: chat.isCreator,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      isSystemBotChat: isSystemBot(chatId),
      isAnonymousForwards: isAnonymousForwardsChat(chatId),
      isBot: Boolean(chatBot),
      isNonContact,
      nameChangeDate,
      photoChangeDate,
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
      isChatProtected: selectIsChatProtected(global, chatId),
      lastMessage: withLastMessageWhenPreloading ? lastMessage : undefined,
      isAccountFrozen,
      hasCustomGreeting,
      isAppConfigLoaded,
      monoforumChannelId,
      canTranslate,
      translationLanguage,
      shouldAutoTranslate,
      canManageBotForumTopics: chat.isBotForum && user?.canManageBotForumTopics,
      shouldScrollToBottom,
      reactionPollingPause: global.reactionPollingPause,
    };
  },
)(MessageList));

function generateChannelJoinMessageId(lastMessageId: number) {
  return lastMessageId + 10e-7; // Smaller than smallest possible id with `getNextLocalMessageId`
}
