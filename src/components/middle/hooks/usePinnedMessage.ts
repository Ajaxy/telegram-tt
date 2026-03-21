import { useEffect, useSignal } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ThreadId } from '../../../types';

import { selectListedIds, selectOutlyingListByMessageId } from '../../../global/selectors';
import cycleRestrict from '../../../util/cycleRestrict';

import useDerivedSignal from '../../../hooks/useDerivedSignal';
import useLastCallback from '../../../hooks/useLastCallback';

export type OnIntersectPinnedMessage = (params: {
  firstViewportId?: number;
  shouldCancelWaiting?: boolean;
}) => void;

export default function usePinnedMessage(
  chatId?: string, threadId?: ThreadId, pinnedIds?: number[],
) {
  const [getPinnedIndexByKey, setPinnedIndexByKey] = useSignal<Record<string, number>>({});
  const [getLoadingPinnedId, setLoadingPinnedId] = useSignal<number | undefined>();
  const key = chatId ? `${chatId}_${threadId}` : undefined;
  const getCurrentPinnedIndex = useDerivedSignal(
    () => (getPinnedIndexByKey()[key!] ?? 0),
    [getPinnedIndexByKey, key],
  );

  // Reset when switching chat
  useEffect(() => {
    setLoadingPinnedId(undefined);
  }, [
    chatId, threadId, setPinnedIndexByKey, setLoadingPinnedId,
  ]);

  useEffect(() => {
    if (!key) return;
    const currentPinnedIndex = getPinnedIndexByKey()[key];
    const pinnedLength = pinnedIds?.length || 0;
    if (currentPinnedIndex >= pinnedLength) {
      setPinnedIndexByKey({
        ...getPinnedIndexByKey(),
        [key]: clampIndex(pinnedLength - 1),
      });
    }
  }, [getPinnedIndexByKey, key, pinnedIds?.length, setPinnedIndexByKey]);

  const handleIntersectPinnedMessage: OnIntersectPinnedMessage = useLastCallback(({
    firstViewportId,
    shouldCancelWaiting,
  }) => {
    if (!chatId || !threadId || !key || !pinnedIds?.length) return;

    if (shouldCancelWaiting) {
      setLoadingPinnedId(undefined);
      return;
    }

    const loadingPinnedId = getLoadingPinnedId();
    if (loadingPinnedId) {
      const newPinnedIndex = pinnedIds.indexOf(loadingPinnedId);
      setPinnedIndexByKey({
        ...getPinnedIndexByKey(),
        [key]: clampIndex(newPinnedIndex),
      });
      setLoadingPinnedId(undefined);

      // We're still scrolling, prevent updating the index
      if (loadingPinnedId < (firstViewportId || 0)) {
        return;
      }
    }

    let newIndex = pinnedIds.findIndex((id) => id < (firstViewportId || 0));
    if (newIndex === -1) {
      newIndex = 0; // Pinned are sorted from newest to oldest
    }

    setPinnedIndexByKey({
      ...getPinnedIndexByKey(),
      [key]: clampIndex(newIndex),
    });
  });

  const handleFocusPinnedMessage = useLastCallback((messageId: number) => {
    // Focusing on a post in comments
    if (!chatId || !threadId || !pinnedIds?.length) {
      return;
    }

    const global = getGlobal();
    const listedIds = selectListedIds(global, chatId, threadId);
    const isMessageLoaded = listedIds?.includes(messageId)
      || selectOutlyingListByMessageId(global, chatId, threadId, messageId);

    const currentIndex = pinnedIds.indexOf(messageId);
    const newIndex = cycleRestrict(pinnedIds.length, currentIndex + 1);

    if (isMessageLoaded) {
      setPinnedIndexByKey({
        ...getPinnedIndexByKey(),
        [key!]: newIndex,
      });
    } else {
      setLoadingPinnedId(pinnedIds[newIndex]);
    }
  });

  return {
    handleIntersectPinnedMessage,
    handleFocusPinnedMessage,
    getCurrentPinnedIndex,
    getLoadingPinnedId,
  };
}

function clampIndex(id: number) {
  return Math.max(0, id);
}
