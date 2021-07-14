import { useEffect, useRef } from '../lib/teact/teact';

import { IS_IOS } from '../util/environment';
import usePrevious from './usePrevious';
import { getDispatch } from '../lib/teact/teactn';

// Carefully selected by swiping and observing visual changes
// TODO: may be different on other devices such as iPad, maybe take dpi into account?
const SAFARI_EDGE_BACK_GESTURE_LIMIT = 300;
const SAFARI_EDGE_BACK_GESTURE_DURATION = 350;

type HistoryState = {
  currentIndex: number;
  nextStateIndexToReplace: number;
  isHistoryAltered: boolean;
  isDisabled: boolean;
  isEdge: boolean;
  currentIndexes: number[];
};

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

window.history.replaceState({ index: historyState.currentIndex }, '');

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
      if (historyState.isHistoryAltered) {
        setTimeout(() => {
          historyState.isHistoryAltered = false;
        }, 0);
        return;
      }
      const { index: i } = event.state;
      const index = i || 0;

      const prev = historyState.currentIndexes[historyState.currentIndexes.indexOf(indexRef.current) - 1];

      if (historyState.isDisabled) return;

      if (!isClosed.current && (index === 0 || index === prev)) {
        historyState.currentIndexes.splice(historyState.currentIndexes.indexOf(indexRef.current), 1);

        if (onBack) {
          if (historyState.isEdge) {
            getDispatch().disableHistoryAnimations();
          }
          onBack(!historyState.isEdge);
          isClosed.current = true;
        }
      } else if (index === indexRef.current && isClosed.current && onForward) {
        isForward.current = true;
        if (historyState.isEdge) {
          getDispatch().disableHistoryAnimations();
        }
        onForward(event.state.state);
      }
    };

    if (!historyState.isDisabled && prevIsActive !== isActive) {
      if (isActive) {
        isClosed.current = false;

        if (isForward.current) {
          isForward.current = false;
          historyState.currentIndexes.push(indexRef.current);
        } else {
          setTimeout(() => {
            const index = ++historyState.currentIndex;

            historyState.currentIndexes.push(index);

            window.history[
              (historyState.currentIndexes.includes(historyState.nextStateIndexToReplace - 1)
                && window.history.state.index !== 0
                && historyState.nextStateIndexToReplace === index
                && !shouldReplaceNext)
                ? 'replaceState'
                : 'pushState'
            ]({
              index,
              state: currentState,
            }, '');

            indexRef.current = index;

            if (shouldReplaceNext) {
              historyState.nextStateIndexToReplace = historyState.currentIndex + 1;
            }
          }, 0);
        }
      } else if (!isClosed.current) {
        if (indexRef.current === historyState.currentIndex || !shouldReplaceNext) {
          historyState.isHistoryAltered = true;
          window.history.back();

          setTimeout(() => {
            historyState.nextStateIndexToReplace = -1;
          }, 400);
        }
        historyState.currentIndexes.splice(historyState.currentIndexes.indexOf(indexRef.current), 1);

        isClosed.current = true;
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentState, isActive, onBack, onForward, prevIsActive, shouldReplaceNext]);
}
