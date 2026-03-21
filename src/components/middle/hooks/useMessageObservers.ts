import { type ElementRef, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { MessageListType, ThreadId } from '../../../types';
import type { OnIntersectPinnedMessage } from './usePinnedMessage';

import { IS_ANDROID } from '../../../util/browser/windowEnvironment';
import { unique } from '../../../util/iteratees';

import useAppLayout from '../../../hooks/useAppLayout';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useBackgroundMode, { isBackgroundModeActive } from '../../../hooks/window/useBackgroundMode';

const INTERSECTION_THROTTLE_FOR_READING = 150;
const INTERSECTION_THROTTLE_FOR_MEDIA = IS_ANDROID ? 1000 : 350;

export default function useMessageObservers({
  type,
  containerRef,
  memoFirstUnreadIdRef,
  chatId,
  threadId,
  isQuickPreview,
  onIntersectPinnedMessage,
}: {
  containerRef: ElementRef<HTMLDivElement>;
  memoFirstUnreadIdRef: { current: number | undefined };
  chatId: string;
  threadId: ThreadId;
  type: MessageListType;
  isQuickPreview?: boolean;
  onIntersectPinnedMessage: OnIntersectPinnedMessage | undefined;
}) {
  const {
    markMessageListRead, markMentionsRead, animateUnreadReaction,
    scheduleForViewsIncrement,
  } = getActions();

  const { isMobile } = useAppLayout();
  const INTERSECTION_MARGIN_FOR_LOADING = isMobile ? 300 : 500;

  const visibleViewportIdsRef = useRef<number[]>([]);
  useEffect(() => {
    visibleViewportIdsRef.current = [];
  }, [threadId, chatId, type]);

  // Note: Targets bottom marker, not the message itself
  const {
    observe: observeIntersectionForReading, freeze: freezeForReading, unfreeze: unfreezeForReading,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_READING,
    threshold: 0,
    // `memoFirstUnreadIdRef` is set after the first render, firing callback before that can skip some entries, like the last message
    shouldSkipFirst: true,
  }, (entries) => {
    if (type !== 'thread' || isBackgroundModeActive()) {
      return;
    }

    let maxId = 0;
    const mentionIds: number[] = [];
    const reactionIds: number[] = [];
    const scheduledToUpdateViews: number[] = [];

    const currentVisibleViewportIds = visibleViewportIdsRef.current;
    const hiddenViewportIds = new Set<number>();
    const newVisibleViewportIds: number[] = [];

    entries.forEach((entry) => {
      const { isIntersecting, target } = entry;

      const { dataset } = target as HTMLDivElement;
      const messageId = Number(dataset.lastMessageId || dataset.messageId);
      const shouldUpdateViews = dataset.shouldUpdateViews === 'true';
      const albumMainId = dataset.albumMainId ? Number(dataset.albumMainId) : undefined;

      if (!isIntersecting) {
        hiddenViewportIds.add(messageId);
        return;
      }

      newVisibleViewportIds.push(messageId);

      if (messageId > maxId) {
        maxId = messageId;
      }

      if (dataset.hasUnreadMention) {
        mentionIds.push(messageId);
      }

      if (dataset.hasUnreadReaction) {
        reactionIds.push(messageId);
      }

      if (shouldUpdateViews) {
        scheduledToUpdateViews.push(albumMainId || messageId);
      }
    });

    visibleViewportIdsRef.current = unique(currentVisibleViewportIds.concat(newVisibleViewportIds))
      .filter((id) => !hiddenViewportIds.has(id))
      .sort((a, b) => a - b);

    if (!isQuickPreview) {
      if (memoFirstUnreadIdRef.current && maxId && maxId >= memoFirstUnreadIdRef.current) {
        markMessageListRead({ maxId });
      }

      if (mentionIds.length) {
        markMentionsRead({ chatId, messageIds: mentionIds });
      }

      if (scheduledToUpdateViews.length) {
        scheduleForViewsIncrement({ chatId, ids: scheduledToUpdateViews });
      }
    }

    if (reactionIds.length) {
      animateUnreadReaction({ chatId, messageIds: reactionIds });
    }

    if (visibleViewportIdsRef.current.length) {
      onIntersectPinnedMessage?.({ firstViewportId: visibleViewportIdsRef.current[0] });
    }
  });

  useBackgroundMode(freezeForReading, unfreezeForReading);

  const {
    observe: observeIntersectionForLoading,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
    margin: INTERSECTION_MARGIN_FOR_LOADING,
  });

  const { observe: observeIntersectionForPlaying } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
  });

  const onMessageUnmount = useLastCallback((messageId: number) => {
    visibleViewportIdsRef.current = visibleViewportIdsRef.current.filter((id) => id !== messageId);
  });

  return {
    observeIntersectionForReading,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
    onMessageUnmount,
  };
}
