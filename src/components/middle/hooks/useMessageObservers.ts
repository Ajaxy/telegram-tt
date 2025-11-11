import type { ElementRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { MessageListType } from '../../../types';
import type { OnIntersectPinnedMessage } from './usePinnedMessage';

import { IS_ANDROID } from '../../../util/browser/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useBackgroundMode, { isBackgroundModeActive } from '../../../hooks/window/useBackgroundMode';

const INTERSECTION_THROTTLE_FOR_READING = 150;
const INTERSECTION_THROTTLE_FOR_MEDIA = IS_ANDROID ? 1000 : 350;

export default function useMessageObservers(
  type: MessageListType,
  containerRef: ElementRef<HTMLDivElement>,
  memoFirstUnreadIdRef: { current: number | undefined },
  onIntersectPinnedMessage: OnIntersectPinnedMessage | undefined,
  chatId: string,
  isQuickPreview?: boolean,
) {
  const {
    markMessageListRead, markMentionsRead, animateUnreadReaction,
    scheduleForViewsIncrement,
  } = getActions();

  const { isMobile } = useAppLayout();
  const INTERSECTION_MARGIN_FOR_LOADING = isMobile ? 300 : 500;

  const {
    observe: observeIntersectionForReading, freeze: freezeForReading, unfreeze: unfreezeForReading,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_READING,
  }, (entries) => {
    if (type !== 'thread' || isBackgroundModeActive()) {
      return;
    }

    let maxId = 0;
    const mentionIds: number[] = [];
    const reactionIds: number[] = [];
    const viewportPinnedIdsToAdd: number[] = [];
    const viewportPinnedIdsToRemove: number[] = [];
    const scheduledToUpdateViews: number[] = [];

    entries.forEach((entry) => {
      const { isIntersecting, target } = entry;

      const { dataset } = target as HTMLDivElement;
      const messageId = Number(dataset.lastMessageId || dataset.messageId);
      const shouldUpdateViews = dataset.shouldUpdateViews === 'true';
      const albumMainId = dataset.albumMainId ? Number(dataset.albumMainId) : undefined;

      if (!isIntersecting) {
        if (dataset.isPinned) {
          viewportPinnedIdsToRemove.push(albumMainId || messageId);
        }
        return;
      }

      if (messageId > maxId) {
        maxId = messageId;
      }

      if (dataset.hasUnreadMention) {
        mentionIds.push(messageId);
      }

      if (dataset.hasUnreadReaction) {
        reactionIds.push(messageId);
      }

      if (dataset.isPinned) {
        viewportPinnedIdsToAdd.push(albumMainId || messageId);
      }

      if (shouldUpdateViews) {
        scheduledToUpdateViews.push(albumMainId || messageId);
      }
    });

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
      animateUnreadReaction({ messageIds: reactionIds });
    }

    if (viewportPinnedIdsToAdd.length || viewportPinnedIdsToRemove.length) {
      onIntersectPinnedMessage?.({ viewportPinnedIdsToAdd, viewportPinnedIdsToRemove });
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

  return {
    observeIntersectionForReading,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
  };
}
