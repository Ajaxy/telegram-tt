import type { ElementRef } from '../../../lib/teact/teact';
import { useRef, useSignal, useState } from '../../../lib/teact/teact';

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
  const intersectingSetsRef = useRef(new Set<Element>());

  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);
  const [getLastVisibleSetIndex, setLastVisibleSetIndex] = useSignal(0);

  const {
    observe: observeIntersectionForSet,
    freeze: freezeForSet,
    unfreeze: unfreezeForSet,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: STICKER_INTERSECTION_THROTTLE,
  }, (entries) => {
    const intersectingSets = intersectingSetsRef.current;

    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        intersectingSets.add(target);
      } else {
        intersectingSets.delete(target);
      }
    });

    if (isAnimatingScroll(containerRef.current)) {
      return;
    }

    let minIntersectingIndex = Infinity;
    let maxIntersectingIndex = -Infinity;
    intersectingSets.forEach((element) => {
      if (!element.isConnected) {
        intersectingSets.delete(element);
        return;
      }

      const index = Number(element.id.replace(`${idPrefix}-`, ''));
      minIntersectingIndex = Math.min(minIntersectingIndex, index);
      maxIntersectingIndex = Math.max(maxIntersectingIndex, index);
    });

    if (minIntersectingIndex === Infinity) {
      return;
    }

    setActiveSetIndex(minIntersectingIndex);
    setLastVisibleSetIndex(maxIntersectingIndex);
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

  const isFrozenWhileHiddenRef = useRef(false);

  useSyncEffect(() => {
    if (isHidden) {
      if (!isFrozenWhileHiddenRef.current) {
        isFrozenWhileHiddenRef.current = true;
        freezeForSet();
        freezeForShowingItems();
      }
    } else {
      const timeout = window.setTimeout(() => {
        isFrozenWhileHiddenRef.current = false;
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
    setLastVisibleSetIndex(index);
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
    getLastVisibleSetIndex,
    observeIntersectionForSet,
    observeIntersectionForShowingItems,
    observeIntersectionForPlayingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  };
}
