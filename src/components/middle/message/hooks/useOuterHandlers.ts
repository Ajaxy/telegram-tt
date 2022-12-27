import type { RefObject } from 'react';
import type React from '../../../../lib/teact/teact';
import { useEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { IS_ANDROID, IS_TOUCH_ENV } from '../../../../util/environment';
import windowSize from '../../../../util/windowSize';
import { captureEvents, SwipeDirection } from '../../../../util/captureEvents';
import useFlag from '../../../../hooks/useFlag';
import { preventMessageInputBlur } from '../../helpers/preventMessageInputBlur';
import stopEvent from '../../../../util/stopEvent';
import { REM } from '../../../common/helpers/mediaDimensions';

const ANDROID_KEYBOARD_HIDE_DELAY_MS = 350;
const SWIPE_ANIMATION_DURATION = 150;
const QUICK_REACTION_DOUBLE_TAP_DELAY = 200;
const QUICK_REACTION_AREA_WIDTH = 3 * REM;
const QUICK_REACTION_AREA_HEIGHT = Number(REM);
const GROUP_MESSAGE_HOVER_ATTRIBUTE = 'data-is-document-group-hover';

export default function useOuterHandlers(
  selectMessage: (e?: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => void,
  containerRef: RefObject<HTMLDivElement>,
  messageId: number,
  isAlbum: boolean,
  isInSelectMode: boolean,
  canReply: boolean,
  isProtected: boolean,
  onContextMenu: (e: React.MouseEvent) => void,
  handleBeforeContextMenu: (e: React.MouseEvent) => void,
  chatId: string,
  isContextMenuShown: boolean,
  contentRef: RefObject<HTMLDivElement>,
  isOwn: boolean,
  shouldHandleMouseLeave: boolean,
) {
  const { setReplyingToId, sendDefaultReaction } = getActions();

  const [isQuickReactionVisible, markQuickReactionVisible, unmarkQuickReactionVisible] = useFlag();
  const [isSwiped, markSwiped, unmarkSwiped] = useFlag();
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout>();

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    preventMessageInputBlur(e);
    handleBeforeContextMenu(e);
  }

  function handleMouseMove(e: React.MouseEvent) {
    const container = contentRef.current;
    if (!container) return;

    const { clientX, clientY } = e;
    const {
      x, width, y, height,
    } = container.getBoundingClientRect();

    const isVisibleX = Math.abs((isOwn ? (clientX - x) : (x + width - clientX))) < QUICK_REACTION_AREA_WIDTH;
    const isVisibleY = Math.abs(y + height - clientY) < QUICK_REACTION_AREA_HEIGHT;
    if (isVisibleX && isVisibleY) {
      markQuickReactionVisible();
    } else {
      unmarkQuickReactionVisible();
    }
  }

  function handleSendQuickReaction() {
    sendDefaultReaction({
      chatId,
      messageId,
    });
  }

  function handleTap(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (IS_ANDROID) {
      const target = e.target as HTMLDivElement;
      if (!target.classList.contains('text-content') && !target.classList.contains('Message')) {
        return;
      }

      if (windowSize.getIsKeyboardVisible()) {
        setTimeout(() => {
          onContextMenu(e);
        }, ANDROID_KEYBOARD_HIDE_DELAY_MS);
      } else {
        onContextMenu(e);
      }
    }
  }

  function handleDoubleTap() {
    sendDefaultReaction({
      chatId,
      messageId,
    });
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (isInSelectMode) {
      selectMessage(e);
      return;
    }

    if (!IS_TOUCH_ENV) return;

    if (doubleTapTimeoutRef.current) {
      clearInterval(doubleTapTimeoutRef.current);
      doubleTapTimeoutRef.current = undefined;
      handleDoubleTap();
      return;
    }

    doubleTapTimeoutRef.current = setTimeout(() => {
      doubleTapTimeoutRef.current = undefined;
      handleTap(e);
    }, QUICK_REACTION_DOUBLE_TAP_DELAY);
  }

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (IS_ANDROID) {
      if ((e.target as HTMLElement).matches('a[href]') || isContextMenuShown) {
        return;
      }

      e.preventDefault();
      selectMessage();
    } else {
      onContextMenu(e);
    }
  }

  function handleContainerDoubleClick() {
    if (IS_TOUCH_ENV) return;

    setReplyingToId({ messageId });
  }

  function stopPropagation(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.stopPropagation();
  }

  useEffect(() => {
    if (!IS_TOUCH_ENV || isInSelectMode || !canReply || isContextMenuShown) {
      return undefined;
    }

    let startedAt: number | undefined;
    return captureEvents(containerRef.current!, {
      selectorToPreventScroll: '.MessageList',
      excludedClosestSelector: '.no-word-wrap',
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          if (!startedAt) {
            startedAt = Date.now();
          }

          markSwiped();

          return true;
        }

        return false;
      }),
      onRelease: () => {
        if (!startedAt) {
          return;
        }

        setReplyingToId({ messageId });

        setTimeout(unmarkSwiped, Math.max(0, SWIPE_ANIMATION_DURATION - (Date.now() - startedAt)));
        startedAt = undefined;
      },
    });
  }, [
    containerRef, isInSelectMode, messageId, setReplyingToId, markSwiped, unmarkSwiped, canReply, isContextMenuShown,
  ]);

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    unmarkQuickReactionVisible();
    if (shouldHandleMouseLeave) handleDocumentGroupMouseLeave(e);
  }

  return {
    handleMouseDown: !isInSelectMode ? handleMouseDown : undefined,
    handleClick,
    handleContextMenu: !isInSelectMode ? handleContextMenu : (isProtected ? stopEvent : undefined),
    handleDoubleClick: !isInSelectMode ? handleContainerDoubleClick : undefined,
    handleContentDoubleClick: !IS_TOUCH_ENV ? stopPropagation : undefined,
    handleMouseMove,
    handleSendQuickReaction,
    handleMouseLeave,
    isSwiped,
    isQuickReactionVisible,
    handleDocumentGroupMouseEnter,
  };
}

function handleDocumentGroupMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
  const lastGroupElement = getLastElementInDocumentGroup(e.currentTarget);
  if (lastGroupElement) {
    lastGroupElement.setAttribute(GROUP_MESSAGE_HOVER_ATTRIBUTE, '');
  }
}

function handleDocumentGroupMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
  const lastGroupElement = getLastElementInDocumentGroup(e.currentTarget);
  if (lastGroupElement) {
    lastGroupElement.removeAttribute(GROUP_MESSAGE_HOVER_ATTRIBUTE);
  }
}

function getLastElementInDocumentGroup(element: Element) {
  let current: Element | null = element;

  do {
    current = current.nextElementSibling;
  } while (current && !current.classList.contains('last-in-document-group'));

  return current;
}
