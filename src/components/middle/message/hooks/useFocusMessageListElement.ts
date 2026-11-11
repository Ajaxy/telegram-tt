import type { ElementRef } from '../../../../lib/teact/teact';
import { useLayoutEffect, useRef } from '../../../../lib/teact/teact';

import type { FocusDirection, ScrollTargetPosition } from '../../../../types';

import { SCROLL_MAX_DISTANCE } from '../../../../config';
import {
  requestMeasure, requestMutation,
} from '../../../../lib/fasterdom/fasterdom';
import animateScroll from '../../../../util/animateScroll';
import { REM } from '../../../common/helpers/mediaDimensions';
import { requestAfterMessageListReflow } from '../../helpers/messageListReflow';
import {
  getEffectiveMessageListBottomReserve,
  getMessageListTopReserve,
  isSendCollapsePhaseActive,
} from '../../helpers/messageListReserves';

// This is used when the viewport was replaced.
const BOTTOM_FOCUS_OFFSET = 500;
const RELOCATED_FOCUS_OFFSET = SCROLL_MAX_DISTANCE;
const FOCUS_MARGIN = 1.25 * REM;
const BOTTOM_FOCUS_MARGIN = 0.5 * REM;
const FORCE_MESSAGES_SCROLL_CLASS = 'force-messages-scroll';
const FEW_MESSAGES_SCROLL_RISE = 4 * REM;

export default function useFocusMessageListElement({
  elementRef,
  isFocused,
  focusDirection,
  noFocusHighlight,
  isResizingContainer,
  isJustAdded,
  isQuotePending,
  getQuoteRange,
  scrollTargetPosition,
}: {
  elementRef: ElementRef<HTMLDivElement>;
  isFocused?: boolean;
  focusDirection?: FocusDirection;
  noFocusHighlight?: boolean;
  isResizingContainer?: boolean;
  isJustAdded?: boolean;
  isQuotePending?: boolean;
  scrollTargetPosition?: ScrollTargetPosition;
  getQuoteRange?: () => Range | undefined;
}) {
  const isRelocatedRef = useRef(!isJustAdded);
  const wasQuotePendingRef = useRef(isQuotePending);

  useLayoutEffect(() => {
    const isRelocated = isRelocatedRef.current;
    isRelocatedRef.current = false;
    // A quote from the unloaded part of a message needs a second, local scroll once it renders
    const isQuoteRevealed = wasQuotePendingRef.current && !isQuotePending;
    wasQuotePendingRef.current = isQuotePending;

    if (isFocused && elementRef.current) {
      const messagesContainer = elementRef.current.closest<HTMLDivElement>('.MessageList');
      if (!messagesContainer) return;

      // `noFocusHighlight` is always called with “scroll-to-bottom” buttons
      const isToBottom = noFocusHighlight;
      const scrollPosition = scrollTargetPosition || (isToBottom ? 'end' : 'centerOrTop');

      const exec = () => {
        const isFewMessagesScroll = Boolean(isToBottom)
          && messagesContainer.parentElement?.classList.contains(FORCE_MESSAGES_SCROLL_CLASS);
        const maxDistance = isQuoteRevealed ? undefined : (isFewMessagesScroll
          ? FEW_MESSAGES_SCROLL_RISE
          : (focusDirection !== undefined
            ? (isToBottom ? BOTTOM_FOCUS_OFFSET : RELOCATED_FOCUS_OFFSET) : undefined));

        const topReserve = getMessageListTopReserve(messagesContainer);
        const bottomReserve = getEffectiveMessageListBottomReserve(messagesContainer);
        const marginReserve = scrollPosition === 'end' ? bottomReserve : topReserve;

        // Scroll to the quote itself so it stays visible in messages taller than the viewport
        const quoteRange = getQuoteRange?.();

        const result = animateScroll({
          container: messagesContainer,
          element: elementRef.current!,
          range: quoteRange,
          position: scrollPosition,
          margin: (isToBottom ? BOTTOM_FOCUS_MARGIN : FOCUS_MARGIN) + marginReserve,
          topReserve,
          bottomReserve,
          maxDistance,
          forceDirection: isQuoteRevealed ? undefined : focusDirection,
          forceNormalContainerHeight: isResizingContainer && !isSendCollapsePhaseActive(messagesContainer),
          shouldReturnMutationFn: true,
        });

        return result;
      };

      if (isRelocated) {
        // We need this to override scroll setting from Message List layout effect
        requestAfterMessageListReflow(exec);
      } else {
        requestMeasure(() => {
          requestMutation(exec()!);
        });
      }
    }
  }, [
    elementRef, isFocused, focusDirection, noFocusHighlight, isResizingContainer, isQuotePending, getQuoteRange,
    scrollTargetPosition,
  ]);
}
