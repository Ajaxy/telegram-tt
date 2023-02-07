import { getActions } from '../../../../global';

import type { FocusDirection } from '../../../../types';

import { useLayoutEffect } from '../../../../lib/teact/teact';
import fastSmoothScroll from '../../../../util/fastSmoothScroll';

// This is used when the viewport was replaced.
const RELOCATED_FOCUS_OFFSET = 1000;
const FOCUS_MARGIN = 20;

export default function useFocusMessage(
  elementRef: { current: HTMLDivElement | null },
  chatId: string,
  isFocused?: boolean,
  focusDirection?: FocusDirection,
  noFocusHighlight?: boolean,
  isResizingContainer?: boolean,
) {
  const { setReachedFocusedMessage } = getActions();

  useLayoutEffect(() => {
    if (isFocused && elementRef.current) {
      const messagesContainer = elementRef.current.closest<HTMLDivElement>('.MessageList')!;

      setReachedFocusedMessage({
        hasReached: true,
      });

      fastSmoothScroll(
        messagesContainer,
        elementRef.current,
        // `noFocusHighlight` always called from “scroll-to-bottom” buttons
        noFocusHighlight ? 'end' : 'centerOrTop',
        FOCUS_MARGIN,
        focusDirection !== undefined ? RELOCATED_FOCUS_OFFSET : undefined,
        focusDirection,
        undefined,
        isResizingContainer,
      );
    }
  }, [
    elementRef, chatId, isFocused, focusDirection, noFocusHighlight, isResizingContainer, setReachedFocusedMessage,
  ]);
}
