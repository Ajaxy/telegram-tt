import { useEffect, useRef } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ThreadId } from '../../../types';

import {
  selectFocusedMessageId,
  selectListedIds,
  selectOutlyingListByMessageId,
} from '../../../global/selectors';
import cycleRestrict from '../../../util/cycleRestrict';
import { unique } from '../../../util/iteratees';
import { clamp } from '../../../util/math';

import useLastCallback from '../../../hooks/useLastCallback';
import useSignal from '../../../hooks/useSignal';

type PinnedIntersectionChangedParams = {
  viewportPinnedIdsToAdd?: number[];
  viewportPinnedIdsToRemove?: number[];
  isReversed?: boolean;
  hasScrolled?: boolean;
  isUnmount?: boolean;
};

export type PinnedIntersectionChangedCallback = (params: PinnedIntersectionChangedParams) => void;

export default function usePinnedMessage(
  chatId?: string, threadId?: ThreadId, pinnedIds?: number[], topMessageId?: number,
) {
  const [getCurrentPinnedIndexes, setCurrentPinnedIndexes] = useSignal<Record<string, number>>({});
  const [getForceNextPinnedInHeader, setForceNextPinnedInHeader] = useSignal<boolean | undefined>();
  const viewportPinnedIdsRef = useRef<number[] | undefined>();
  const [getLoadingPinnedId, setLoadingPinnedId] = useSignal<number | undefined>();

  const key = chatId ? `${chatId}_${threadId}` : undefined;

  // Reset when switching chat
  useEffect(() => {
    setForceNextPinnedInHeader(undefined);
    viewportPinnedIdsRef.current = undefined;
    setLoadingPinnedId(undefined);
  }, [
    chatId, setCurrentPinnedIndexes, setForceNextPinnedInHeader, setLoadingPinnedId, threadId,
  ]);

  useEffect(() => {
    if (!key) return;
    const currentPinnedIndex = getCurrentPinnedIndexes()[key];
    const pinnedLength = pinnedIds?.length || 0;
    if (currentPinnedIndex >= pinnedLength) {
      setCurrentPinnedIndexes({
        ...getCurrentPinnedIndexes(),
        [key]: Math.max(0, pinnedLength - 1),
      });
    }
  }, [getCurrentPinnedIndexes, key, pinnedIds?.length, setCurrentPinnedIndexes]);

  const onIntersectionChanged = useLastCallback(({
    viewportPinnedIdsToAdd = [], viewportPinnedIdsToRemove = [], isReversed, hasScrolled, isUnmount,
  }: PinnedIntersectionChangedParams) => {
    if (!chatId || !threadId || !key) return;

    const global = getGlobal();

    const pinnedMessagesCount = pinnedIds?.length || 0;

    if (!pinnedMessagesCount || !pinnedIds) return;

    const waitingForPinnedId = getLoadingPinnedId();
    if (waitingForPinnedId && !hasScrolled) {
      const newPinnedIndex = pinnedIds.indexOf(waitingForPinnedId);
      setCurrentPinnedIndexes({
        ...getCurrentPinnedIndexes(),
        [key]: newPinnedIndex,
      });
      setLoadingPinnedId(undefined);
    }

    if (hasScrolled) {
      setForceNextPinnedInHeader(undefined);
      setLoadingPinnedId(undefined);
    }

    const forceNextPinnedInHeader = getForceNextPinnedInHeader();

    const currentViewportPinnedIds = viewportPinnedIdsRef.current;

    // Unmounting the Message component will fire this action, and if we've already marked the pin as
    // outside the viewport, we don't need to do anything
    if (isUnmount
      && viewportPinnedIdsToAdd.length === 0 && viewportPinnedIdsToRemove.length === 1
      && !currentViewportPinnedIds?.includes(viewportPinnedIdsToRemove[0])) {
      return;
    }

    const newPinnedViewportIds = unique(
      (currentViewportPinnedIds?.filter((id) => !viewportPinnedIdsToRemove.includes(id)) || [])
        .concat(viewportPinnedIdsToAdd),
    );

    viewportPinnedIdsRef.current = newPinnedViewportIds;

    const focusedMessageId = selectFocusedMessageId(global, chatId);
    // Focused to some non-pinned message
    if (!newPinnedViewportIds.length && isUnmount && focusedMessageId && !pinnedIds.includes(focusedMessageId)) {
      const firstPinnedIdAfterFocused = pinnedIds.find((id) => id < focusedMessageId);
      if (firstPinnedIdAfterFocused) {
        const newIndex = pinnedIds.indexOf(firstPinnedIdAfterFocused);
        setCurrentPinnedIndexes({
          ...getCurrentPinnedIndexes(),
          [key]: newIndex,
        });
      }
    }

    if (forceNextPinnedInHeader || isUnmount) {
      return;
    }

    const maxId = Math.max(...newPinnedViewportIds);
    const maxIdIndex = pinnedIds.findIndex((id) => id === maxId);
    const delta = isReversed ? 0 : 1;
    const newIndex = newPinnedViewportIds.length ? maxIdIndex : (
      currentViewportPinnedIds?.length
        ? clamp(pinnedIds.indexOf(currentViewportPinnedIds[0]) + delta, 0, pinnedIds.length - 1)
        : 0
    );

    setCurrentPinnedIndexes({
      ...getCurrentPinnedIndexes(),
      [key]: newIndex,
    });
  });

  const onFocusPinnedMessage = useLastCallback((messageId: number): boolean => {
    if (!chatId || !threadId || !key || getLoadingPinnedId()) return false;

    const global = getGlobal();
    if (!pinnedIds?.length) {
      // Focusing on a post in comments
      return topMessageId === messageId;
    }

    const index = pinnedIds.indexOf(messageId);
    const newPinnedIndex = cycleRestrict(pinnedIds.length, index + 1);
    setForceNextPinnedInHeader(true);

    const listedIds = selectListedIds(global, chatId, threadId);
    const isMessageLoaded = listedIds?.includes(messageId)
      || selectOutlyingListByMessageId(global, chatId, threadId, messageId);

    if (isMessageLoaded) {
      setCurrentPinnedIndexes({
        ...getCurrentPinnedIndexes(),
        [key]: newPinnedIndex,
      });
      return true;
    } else {
      setLoadingPinnedId(pinnedIds[newPinnedIndex]);
      return true;
    }
  });

  return {
    onIntersectionChanged,
    onFocusPinnedMessage,
    getCurrentPinnedIndexes,
    getLoadingPinnedId,
    getForceNextPinnedInHeader,
  };
}
