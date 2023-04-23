import type { RefObject } from 'react';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useSyncEffect from '../../../hooks/useSyncEffect';
import { useRef } from '../../../lib/teact/teact';
import { ANIMATION_END_DELAY } from '../../../config';

const STICKER_INTERSECTION_THROTTLE = 200;
const STICKER_INTERSECTION_MARGIN = 100;
const SLIDE_TRANSITION_DURATION = 350 + ANIMATION_END_DELAY;

export function useStickerPickerObservers(
  containerRef: RefObject<HTMLDivElement>,
  headerRef: RefObject<HTMLDivElement>,
  idPrefix: string,
  setActiveSetIndex: (index: number) => void,
  isHidden?: boolean,
) {
  const stickerSetIntersectionsRef = useRef<boolean[]>([]);

  const {
    observe: observeIntersectionForSet,
    freeze: freezeForSet,
    unfreeze: unfreezeForSet,
  } = useIntersectionObserver({
    rootRef: containerRef,
  }, (entries) => {
    const stickerSetIntersections = stickerSetIntersectionsRef.current;

    entries.forEach((entry) => {
      const index = Number(entry.target.id.replace(`${idPrefix}-`, ''));
      stickerSetIntersections[index] = entry.isIntersecting;
    });

    const minIntersectingIndex = stickerSetIntersections.reduce((lowestIndex, isIntersecting, index) => {
      return isIntersecting && index < lowestIndex ? index : lowestIndex;
    }, Infinity);

    if (minIntersectingIndex === Infinity) {
      return;
    }

    setActiveSetIndex(minIntersectingIndex);
  });

  const {
    observe: observeIntersectionForShowingItems,
    freeze: freezeForShowingItems,
    unfreeze: unfreezeForShowingItems,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: STICKER_INTERSECTION_THROTTLE,
    margin: STICKER_INTERSECTION_MARGIN,
  });

  const {
    observe: observeIntersectionForPlayingItems,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: STICKER_INTERSECTION_THROTTLE,
    margin: STICKER_INTERSECTION_MARGIN,
  });

  const {
    observe: observeIntersectionForCovers,
  } = useIntersectionObserver({
    rootRef: headerRef,
  });

  useSyncEffect(() => {
    if (isHidden) {
      freezeForSet();
      freezeForShowingItems();
    } else {
      setTimeout(() => {
        unfreezeForShowingItems();
        unfreezeForSet();
      }, SLIDE_TRANSITION_DURATION);
    }
  }, [freezeForSet, freezeForShowingItems, isHidden, unfreezeForSet, unfreezeForShowingItems]);

  return {
    observeIntersectionForSet,
    observeIntersectionForShowingItems,
    observeIntersectionForPlayingItems,
    observeIntersectionForCovers,
  };
}
