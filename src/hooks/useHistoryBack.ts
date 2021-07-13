import { useEffect, useRef } from '../lib/teact/teact';

import { IS_IOS } from '../util/environment';
import usePrevious from './usePrevious';
import { getDispatch } from '../lib/teact/teactn';

// Carefully selected by swiping and observing visual changes
// TODO: may be different on other devices such as iPad, maybe take dpi into account?
const SAFARI_EDGE_BACK_GESTURE_LIMIT = 300;
const SAFARI_EDGE_BACK_GESTURE_DURATION = 350;

let isEdge = false;

const handleTouchStart = (event: TouchEvent) => {
  const x = event.touches[0].pageX;

  if (x <= SAFARI_EDGE_BACK_GESTURE_LIMIT || x >= window.innerWidth - SAFARI_EDGE_BACK_GESTURE_LIMIT) {
    isEdge = true;
  }
};

const handleTouchEnd = () => {
  if (isEdge) {
    setTimeout(() => {
      isEdge = false;
    }, SAFARI_EDGE_BACK_GESTURE_DURATION);
  }
};

if (IS_IOS) {
  window.addEventListener('touchstart', handleTouchStart);
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('popstate', handleTouchEnd);
}

let currentIndex = 0;
let nextStateIndexToReplace = -1;
let isHistoryAltered = false;
const currentIndexes: number[] = [];

window.history.replaceState({ index: currentIndex }, '');

export default function useHistoryBack(
  isActive: boolean | undefined,
  onBack: ((noDisableAnimation: boolean) => void) | undefined,
  onForward?: (state: any) => void,
  currentState?: any,
  shouldReplaceNext = false,
) {
  const indexRef = useRef(-1);
  const isForward = useRef(false);
  const prevIsActive = usePrevious(isActive);
  const isClosed = useRef(true);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isHistoryAltered) {
        setTimeout(() => {
          isHistoryAltered = false;
        }, 0);
        return;
      }
      const { index: i } = event.state;
      const index = i || 0;

      const prev = currentIndexes[currentIndexes.indexOf(indexRef.current) - 1];

      if (!isClosed.current && (index === 0 || index === prev)) {
        currentIndexes.splice(currentIndexes.indexOf(indexRef.current), 1);

        if (onBack) {
          if (isEdge) {
            getDispatch().disableHistoryAnimations();
          }
          onBack(!isEdge);
          isClosed.current = true;
        }
      } else if (index === indexRef.current && isClosed.current && onForward) {
        isForward.current = true;
        if (isEdge) {
          getDispatch().disableHistoryAnimations();
        }
        onForward(event.state.state);
      }
    };

    if (prevIsActive !== isActive) {
      if (isActive) {
        isClosed.current = false;

        if (isForward.current) {
          isForward.current = false;
          currentIndexes.push(indexRef.current);
        } else {
          setTimeout(() => {
            const index = ++currentIndex;

            currentIndexes.push(index);

            window.history[
              (currentIndexes.includes(nextStateIndexToReplace - 1)
                && window.history.state.index !== 0
                && nextStateIndexToReplace === index
                && !shouldReplaceNext)
                ? 'replaceState'
                : 'pushState'
            ]({
              index,
              state: currentState,
            }, '');

            indexRef.current = index;

            if (shouldReplaceNext) {
              nextStateIndexToReplace = currentIndex + 1;
            }
          }, 0);
        }
      } else if (!isClosed.current) {
        if (indexRef.current === currentIndex || !shouldReplaceNext) {
          isHistoryAltered = true;
          window.history.back();

          setTimeout(() => {
            nextStateIndexToReplace = -1;
          }, 400);
        }
        currentIndexes.splice(currentIndexes.indexOf(indexRef.current), 1);

        isClosed.current = true;
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentState, isActive, onBack, onForward, prevIsActive, shouldReplaceNext]);
}
