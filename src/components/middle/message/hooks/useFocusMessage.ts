import { useLayoutEffect } from '../../../../lib/teact/teact';
import fastSmoothScroll from '../../../../util/fastSmoothScroll';
import { FocusDirection } from '../../../../types';

// This is the max scroll offset within existing viewport.
const FOCUS_MAX_OFFSET = 1500;
// This is used when the viewport was replaced.
const RELOCATED_FOCUS_OFFSET = 1000;
const FOCUS_MARGIN = 20;

export default function useFocusMessage(
  elementRef: { current: HTMLDivElement | null },
  chatId: number,
  isFocused?: boolean,
  focusDirection?: FocusDirection,
  noFocusHighlight?: boolean,
) {
  useLayoutEffect(() => {
    if (isFocused && elementRef.current) {
      const messagesContainer = elementRef.current.closest<HTMLDivElement>('.MessageList')!;

      fastSmoothScroll(
        messagesContainer,
        elementRef.current,
        // `noFocusHighlight` always called from “scroll-to-bottom” buttons
        noFocusHighlight ? 'end' : 'centerOrTop',
        FOCUS_MARGIN,
        focusDirection === undefined ? FOCUS_MAX_OFFSET : RELOCATED_FOCUS_OFFSET,
        focusDirection,
      );
    }
  }, [elementRef, chatId, isFocused, focusDirection, noFocusHighlight]);
}
