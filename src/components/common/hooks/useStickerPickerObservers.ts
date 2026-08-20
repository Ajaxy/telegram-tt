import type { ElementRef } from '../../../lib/teact/teact';
import { useRef, useState } from '../../../lib/teact/teact';

import animateScroll, { isAnimatingScroll } from '../../../util/animateScroll';
import { REM } from '../helpers/mediaDimensions';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';

const STICKER_INTERSECTION_THROTTLE = 200;
const STICKER_INTERSECTION_MARGIN = 100;
const STICKER_SHOWING_MARGIN = 100;
const COVERS_INTERSECTION_MARGIN = 200;
const UNFREEZE_DELAY = 200;
const SCROLL_MAX_DISTANCE_WHEN_CLOSE = 200;
const SCROLL_MAX_DISTANCE_WHEN_FAR = 80;
const FOCUS_MARGIN = 0.5 * REM;

export function useStickerPickerObservers(
  containerRef: ElementRef<HTMLDivElement>,
  headerRef: ElementRef<HTMLDivElement>,
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
    throttleMs: STICKER_INTERSECTION_THROTTLE,
  }, (entries) => {
    const stickerSetIntersections = stickerSetIntersectionsRef.current;

    entries.forEach((entry) => {
      const index = Number(entry.target.id.replace(`${idPrefix}-`, ''));
      stickerSetIntersections[index] = entry.isIntersecting;
    });

    if (isAnimatingScroll(containerRef.current)) {
      return;
    }

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
    margin: STICKER_SHOWING_MARGIN,
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
    throttleMs: STICKER_INTERSECTION_THROTTLE,
    margin: COVERS_INTERSECTION_MARGIN,
  });

  useSyncEffect(() => {
    if (isHidden) {
      freezeForSet();
      freezeForShowingItems();
    } else {
      const timeout = window.setTimeout(() => {
        unfreezeForShowingItems();
        unfreezeForSet();
      }, UNFREEZE_DELAY);

      return () => {
        clearTimeout(timeout);
      };
    }
    return undefined;
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
        noHeavyAnimation: true,
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
