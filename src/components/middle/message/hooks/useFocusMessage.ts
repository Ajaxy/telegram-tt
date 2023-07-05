import { useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { requestForcedReflow, requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';

import type { FocusDirection } from '../../../../types';

import animateScroll from '../../../../util/animateScroll';

// This is used when the viewport was replaced.
const BOTTOM_FOCUS_OFFSET = 500;
const RELOCATED_FOCUS_OFFSET = 750;
const FOCUS_MARGIN = 20;

export default function useFocusMessage(
  elementRef: { current: HTMLDivElement | null },
  chatId: string,
  isFocused?: boolean,
  focusDirection?: FocusDirection,
  noFocusHighlight?: boolean,
  isResizingContainer?: boolean,
  isJustAdded?: boolean,
) {
  const isRelocatedRef = useRef(!isJustAdded);

  useLayoutEffect(() => {
    const isRelocated = isRelocatedRef.current;
    isRelocatedRef.current = false;

    if (isFocused && elementRef.current) {
      const messagesContainer = elementRef.current.closest<HTMLDivElement>('.MessageList')!;
      // `noFocusHighlight` is always called with “scroll-to-bottom” buttons
      const isToBottom = noFocusHighlight;

      const exec = () => animateScroll(
        messagesContainer,
        elementRef.current!,
        isToBottom ? 'end' : 'centerOrTop',
        FOCUS_MARGIN,
        focusDirection !== undefined ? (isToBottom ? BOTTOM_FOCUS_OFFSET : RELOCATED_FOCUS_OFFSET) : undefined,
        focusDirection,
        undefined,
        isResizingContainer,
        true,
      );

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
    elementRef, chatId, isFocused, focusDirection, noFocusHighlight, isResizingContainer,
  ]);
}
