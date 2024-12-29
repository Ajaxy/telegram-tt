import { useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { addExtraClass } from '../../../../lib/teact/teact-dom';

import type { FocusDirection, ScrollTargetPosition } from '../../../../types';

import { SCROLL_MAX_DISTANCE } from '../../../../config';
import {
  requestForcedReflow, requestMeasure, requestMutation,
} from '../../../../lib/fasterdom/fasterdom';
import animateScroll from '../../../../util/animateScroll';

// This is used when the viewport was replaced.
const BOTTOM_FOCUS_OFFSET = 500;
const RELOCATED_FOCUS_OFFSET = SCROLL_MAX_DISTANCE;
const FOCUS_MARGIN = 20;

export default function useFocusMessage({
  elementRef,
  chatId,
  isFocused,
  focusDirection,
  noFocusHighlight,
  isResizingContainer,
  isJustAdded,
  isQuote,
  scrollTargetPosition,
}: {
  elementRef: { current: HTMLDivElement | null };
  chatId: string;
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
      const messagesContainer = elementRef.current.closest<HTMLDivElement>('.MessageList')!;
      // `noFocusHighlight` is always called with “scroll-to-bottom” buttons
      const isToBottom = noFocusHighlight;
      const scrollPosition = scrollTargetPosition || isToBottom ? 'end' : 'centerOrTop';

      const exec = () => {
        const maxDistance = focusDirection !== undefined
          ? (isToBottom ? BOTTOM_FOCUS_OFFSET : RELOCATED_FOCUS_OFFSET) : undefined;

        const result = animateScroll({
          container: messagesContainer,
          element: elementRef.current!,
          position: scrollPosition,
          margin: FOCUS_MARGIN,
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
    elementRef, chatId, isFocused, focusDirection, noFocusHighlight, isResizingContainer, isQuote, scrollTargetPosition,
  ]);
}
