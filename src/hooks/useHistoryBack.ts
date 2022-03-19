import { useCallback, useEffect, useRef } from '../lib/teact/teact';

import { IS_IOS } from '../util/environment';
import usePrevious from './usePrevious';
import { getDispatch } from '../modules';
import { areSortedArraysEqual } from '../util/iteratees';

type HistoryState = {
  currentIndex: number;
  nextStateIndexToReplace: number;
  isHistoryAltered: boolean;
  isDisabled: boolean;
  isEdge: boolean;
  currentIndexes: number[];
};

// Carefully selected by swiping and observing visual changes
// TODO: may be different on other devices such as iPad, maybe take dpi into account?
const SAFARI_EDGE_BACK_GESTURE_LIMIT = 300;
const SAFARI_EDGE_BACK_GESTURE_DURATION = 350;
export const LOCATION_HASH = window.location.hash;
const PATH_BASE = `${window.location.pathname}${window.location.search}`;

const historyState: HistoryState = {
  currentIndex: 0,
  nextStateIndexToReplace: -1,
  isHistoryAltered: false,
  isDisabled: false,
  isEdge: false,
  currentIndexes: [],
};

export const disableHistoryBack = () => {
  historyState.isDisabled = true;
};

const handleTouchStart = (event: TouchEvent) => {
  const x = event.touches[0].pageX;

  if (x <= SAFARI_EDGE_BACK_GESTURE_LIMIT || x >= window.innerWidth - SAFARI_EDGE_BACK_GESTURE_LIMIT) {
    historyState.isEdge = true;
  }
};

const handleTouchEnd = () => {
  if (historyState.isEdge) {
    setTimeout(() => {
      historyState.isEdge = false;
    }, SAFARI_EDGE_BACK_GESTURE_DURATION);
  }
};

if (IS_IOS) {
  window.addEventListener('touchstart', handleTouchStart);
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('popstate', handleTouchEnd);
}

window.history.replaceState({ index: historyState.currentIndex }, '', PATH_BASE);

export default function useHistoryBack(
  isActive: boolean | undefined,
  onBack: ((noDisableAnimation: boolean) => void) | undefined,
  onForward?: (state: any) => void,
  currentState?: any,
  shouldReplaceNext = false,
  hashes?: string[],
) {
  const indexRef = useRef(-1);
  const isForward = useRef(false);
  const prevIsActive = usePrevious(isActive);
  const isClosed = useRef(true);
  const indexHashRef = useRef<{ index: number; hash: string }[]>([]);
  const prevHashes = usePrevious(hashes);
  const isHashChangedFromEvent = useRef<boolean>(false);

  const handleChange = useCallback((isForceClose = false) => {
    if (!hashes) {
      if (isActive && !isForceClose) {
        isClosed.current = false;

        if (isForward.current) {
          isForward.current = false;
          historyState.currentIndexes.push(indexRef.current);
        } else {
          setTimeout(() => {
            const index = ++historyState.currentIndex;

            historyState.currentIndexes.push(index);

            window.history[(
              (
                historyState.currentIndexes.includes(historyState.nextStateIndexToReplace - 1)
                && window.history.state.index !== 0
                && historyState.nextStateIndexToReplace === index
                && !shouldReplaceNext
              )
                ? 'replaceState'
                : 'pushState'
            )]({
              index,
              state: currentState,
            }, '');

            indexRef.current = index;

            if (shouldReplaceNext) {
              historyState.nextStateIndexToReplace = historyState.currentIndex + 1;
            }
          }, 0);
        }
      }

      if ((isForceClose || !isActive) && !isClosed.current) {
        if ((indexRef.current === historyState.currentIndex || !shouldReplaceNext)) {
          historyState.isHistoryAltered = true;
          window.history.back();

          setTimeout(() => {
            historyState.nextStateIndexToReplace = -1;
          }, 400);
        }
        historyState.currentIndexes.splice(historyState.currentIndexes.indexOf(indexRef.current), 1);

        isClosed.current = true;
      }
    } else {
      const prev = prevHashes || [];
      if (prev.length < hashes.length) {
        setTimeout(() => {
          const index = ++historyState.currentIndex;
          historyState.currentIndexes.push(index);

          window.history.pushState({
            index,
            state: currentState,
          }, '', `#${hashes[hashes.length - 1]}`);

          indexHashRef.current.push({
            index,
            hash: hashes[hashes.length - 1],
          });
        }, 0);
      } else {
        const delta = prev.length - hashes.length;
        if (isHashChangedFromEvent.current) {
          isHashChangedFromEvent.current = false;
        } else {
          if (hashes.length !== indexHashRef.current.length) {
            if (delta > 0) {
              const last = indexHashRef.current[indexHashRef.current.length - delta - 1];
              let realDelta = delta;
              if (last) {
                const indexLast = historyState.currentIndexes.findIndex(
                  (l) => l === last.index,
                );
                realDelta = historyState.currentIndexes.length - indexLast - 1;
              }
              historyState.isHistoryAltered = true;
              window.history.go(-realDelta);
              const removed = indexHashRef.current.splice(indexHashRef.current.length - delta - 1, delta);
              removed.forEach(({ index }) => {
                historyState.currentIndexes.splice(historyState.currentIndexes.indexOf(index), 1);
              });
            }
          }

          if (hashes.length > 0) {
            setTimeout(() => {
              const index = ++historyState.currentIndex;
              historyState.currentIndexes[historyState.currentIndexes.length - 1] = index;

              window.history.replaceState({
                index,
                state: currentState,
              }, '', `${PATH_BASE}#${hashes[hashes.length - 1]}`);

              indexHashRef.current[indexHashRef.current.length - 1] = {
                index,
                hash: hashes[hashes.length - 1],
              };
            }, 0);
          }
        }
      }
    }
  }, [currentState, hashes, isActive, prevHashes, shouldReplaceNext]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (historyState.isHistoryAltered) {
        setTimeout(() => {
          historyState.isHistoryAltered = false;
        }, 0);
        return;
      }
      const { index: i } = event.state;
      const index = i || 0;
      try {
        const currIndex = hashes ? indexHashRef.current[indexHashRef.current.length - 1].index : indexRef.current;

        const prev = historyState.currentIndexes[historyState.currentIndexes.indexOf(currIndex) - 1];

        if (historyState.isDisabled) return;

        if ((!isClosed.current && (index === 0 || index === prev)) || (hashes && (index === 0 || index === prev))) {
          if (hashes) {
            isHashChangedFromEvent.current = true;
            indexHashRef.current.pop();
          }

          historyState.currentIndexes.splice(historyState.currentIndexes.indexOf(currIndex), 1);

          if (onBack) {
            if (historyState.isEdge) {
              getDispatch()
                .disableHistoryAnimations();
            }
            onBack(!historyState.isEdge);
            isClosed.current = true;
          }
        } else if (index === currIndex && isClosed.current && onForward && !hashes) {
          isForward.current = true;
          if (historyState.isEdge) {
            getDispatch()
              .disableHistoryAnimations();
          }
          onForward(event.state.state);
        }
      } catch (e) {
        // Forward navigation for hashed is not supported
      }
    };

    const hasChanged = hashes
      ? (!prevHashes || !areSortedArraysEqual(prevHashes, hashes))
      : prevIsActive !== isActive;

    if (!historyState.isDisabled && hasChanged) {
      handleChange();
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    currentState, handleChange, hashes, isActive, onBack, onForward, prevHashes, prevIsActive, shouldReplaceNext,
  ]);

  return {
    forceClose: () => handleChange(true),
  };
}
