import type { ElementRef } from '../../../../lib/teact/teact';
import { useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { addExtraClass } from '../../../../lib/teact/teact-dom';

import type { FocusDirection, ScrollTargetPosition } from '../../../../types';

import { SCROLL_MAX_DISTANCE } from '../../../../config';
import {
  requestForcedReflow, requestMeasure, requestMutation,
} from '../../../../lib/fasterdom/fasterdom';
import animateScroll from '../../../../util/animateScroll';
import { REM } from '../../../common/helpers/mediaDimensions';

// This is used when the viewport was replaced.
const BOTTOM_FOCUS_OFFSET = 500;
const RELOCATED_FOCUS_OFFSET = SCROLL_MAX_DISTANCE;
const FOCUS_MARGIN = 1.25 * REM;
const BOTTOM_FOCUS_MARGIN = 0.5 * REM;

export default function useFocusMessageListElement({
  elementRef,
  isFocused,
  focusDirection,
  noFocusHighlight,
  isResizingContainer,
  isJustAdded,
  isQuote,
  scrollTargetPosition,
}: {
  elementRef: ElementRef<HTMLDivElement>;
  isFocused?: boolean;
  focusDirection?: FocusDirection;
  noFocusHighlight?: boolean;
  isResizingContainer?: boolean;
  isJustAdded?: boolean;
  isQuote?: boolean;
  scrollTargetPosition?: ScrollTargetPosition;
}) {
  const isRelocatedRef = useRef(!isJustAdded);

  useLayoutEffect(() => {
    const isRelocated = isRelocatedRef.current;
    isRelocatedRef.current = false;

    if (isFocused && elementRef.current) {
      const messagesContainer = elementRef.current.closest<HTMLDivElement>('.MessageList');
      if (!messagesContainer) return;

      // `noFocusHighlight` is always called with “scroll-to-bottom” buttons
      const isToBottom = noFocusHighlight;
      const scrollPosition = scrollTargetPosition || (isToBottom ? 'end' : 'centerOrTop');

      const exec = () => {
        const maxDistance = focusDirection !== undefined
          ? (isToBottom ? BOTTOM_FOCUS_OFFSET : RELOCATED_FOCUS_OFFSET) : undefined;

        const result = animateScroll({
          container: messagesContainer,
          element: elementRef.current!,
          position: scrollPosition,
          margin: isToBottom ? BOTTOM_FOCUS_MARGIN : FOCUS_MARGIN,
          maxDistance,
          forceDirection: focusDirection,
          forceNormalContainerHeight: isResizingContainer,
          shouldReturnMutationFn: true,
        });

        if (isQuote) {
          const firstQuote = elementRef.current!.querySelector<HTMLSpanElement>('.is-quote');
          if (firstQuote) {
            requestMutation(() => {
              addExtraClass(firstQuote, 'animate');
            });
          }
        }

        return result;
      };

      if (isRelocated) {
        // We need this to override scroll setting from Message List layout effect
        requestForcedReflow(exec);
      } else {
        requestMeasure(() => {
          requestMutation(exec()!);
        });
      }
    }
  }, [
    elementRef, isFocused, focusDirection, noFocusHighlight, isResizingContainer, isQuote, scrollTargetPosition,
  ]);
}
