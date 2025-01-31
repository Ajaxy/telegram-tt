import type { RefObject } from 'react';
import { useRef, useState } from '../../../lib/teact/teact';

import { ANIMATION_END_DELAY } from '../../../config';
import animateScroll from '../../../util/animateScroll';
import { REM } from '../helpers/mediaDimensions';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';

const STICKER_INTERSECTION_THROTTLE = 200;
const STICKER_INTERSECTION_MARGIN = 100;
const SLIDE_TRANSITION_DURATION = 350 + ANIMATION_END_DELAY;
const SCROLL_MAX_DISTANCE_WHEN_CLOSE = 200;
const SCROLL_MAX_DISTANCE_WHEN_FAR = 80;
const FOCUS_MARGIN = 0.5 * REM;

export function useStickerPickerObservers(
  containerRef: RefObject<HTMLDivElement>,
  headerRef: RefObject<HTMLDivElement>,
  idPrefix: string,
  isHidden?: boolean,
) {
  const stickerSetIntersectionsRef = useRef<boolean[]>([]);

  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);

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

  const selectStickerSet = useLastCallback((index: number) => {
    setActiveSetIndex((currentIndex) => {
      const stickerSetEl = document.getElementById(`${idPrefix}-${index}`)!;
      const isClose = Math.abs(currentIndex - index) === 1;

      animateScroll({
        container: containerRef.current!,
        element: stickerSetEl,
        position: 'start',
        margin: FOCUS_MARGIN,
        maxDistance: isClose ? SCROLL_MAX_DISTANCE_WHEN_CLOSE : SCROLL_MAX_DISTANCE_WHEN_FAR,
      });

      return index;
    });
  });

  return {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForShowingItems,
    observeIntersectionForPlayingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  };
}
