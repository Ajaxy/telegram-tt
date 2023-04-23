import { useLayoutEffect, useMemo } from '../../../../lib/teact/teact';

import type { FocusDirection } from '../../../../types';

import fastSmoothScroll from '../../../../util/fastSmoothScroll';

// This is used when the viewport was replaced.
const BOTTOM_FOCUS_OFFSET = 500;
const RELOCATED_FOCUS_OFFSET = 750;
const FOCUS_MARGIN = 20;

export default function useFocusMessage(
  elementRef: { current: HTMLDivElement | null },
  messageId: number,
  chatId: string,
  isFocused?: boolean,
  focusDirection?: FocusDirection,
  noFocusHighlight?: boolean,
  viewportIds?: number[],
  isResizingContainer?: boolean,
) {
  const viewportIndex = useMemo(() => {
    if (!viewportIds) {
      return 0;
    }

    const index = viewportIds.indexOf(messageId);
    return Math.min(index, viewportIds.length - index - 1);
  }, [messageId, viewportIds]);

  useLayoutEffect(() => {
    if (isFocused && elementRef.current) {
      const messagesContainer = elementRef.current.closest<HTMLDivElement>('.MessageList')!;
      // `noFocusHighlight` is always called with “scroll-to-bottom” buttons
      const isToBottom = noFocusHighlight;

      fastSmoothScroll(
        messagesContainer,
        elementRef.current,
        isToBottom ? 'end' : 'centerOrTop',
        FOCUS_MARGIN,
        focusDirection !== undefined ? (isToBottom ? BOTTOM_FOCUS_OFFSET : RELOCATED_FOCUS_OFFSET) : undefined,
        focusDirection,
        undefined,
        isResizingContainer,
        // We need this to override scroll setting from Message List layout effect
        true,
      );
    }
  }, [
    elementRef, chatId, isFocused, focusDirection, noFocusHighlight, isResizingContainer, viewportIndex,
  ]);
}
