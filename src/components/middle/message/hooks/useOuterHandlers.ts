import { RefObject } from 'react';
import React, { useEffect } from '../../../../lib/teact/teact';
import { getDispatch } from '../../../../lib/teact/teactn';

import { IS_ANDROID, IS_TOUCH_ENV } from '../../../../util/environment';
import windowSize from '../../../../util/windowSize';
import { captureEvents, SwipeDirection } from '../../../../util/captureEvents';
import useFlag from '../../../../hooks/useFlag';
import { preventMessageInputBlur } from '../../helpers/preventMessageInputBlur';

const ANDROID_KEYBOARD_HIDE_DELAY_MS = 350;
const SWIPE_ANIMATION_DURATION = 150;

export default function useOuterHandlers(
  selectMessage: (e?: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => void,
  containerRef: RefObject<HTMLDivElement>,
  messageId: number,
  isLocal: boolean,
  isAlbum: boolean,
  isInSelectMode: boolean,
  onContextMenu: (e: React.MouseEvent) => void,
  handleBeforeContextMenu: (e: React.MouseEvent) => void,
) {
  const { setReplyingToId } = getDispatch();

  const [isSwiped, markSwiped, unmarkSwiped] = useFlag();

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    preventMessageInputBlur(e);

    if (!isLocal) {
      handleBeforeContextMenu(e);
    }
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (isInSelectMode && !isLocal) {
      selectMessage(e);
    } else if (IS_ANDROID) {
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

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (IS_ANDROID) {
      if (!(e.target as HTMLElement).matches('a[href]')) {
        return;
      }

      e.preventDefault();
      selectMessage();
    } else {
      onContextMenu(e);
    }
  }

  function handleContainerDoubleClick() {
    setReplyingToId({ messageId });
  }

  function stopPropagation(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.stopPropagation();
  }

  useEffect(() => {
    if (!IS_TOUCH_ENV || isInSelectMode) {
      return undefined;
    }

    let startedAt: number | undefined;
    return captureEvents(containerRef.current!, {
      selectorToPreventScroll: '.MessageList',
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
  }, [containerRef, isInSelectMode, messageId, setReplyingToId, markSwiped, unmarkSwiped]);

  return {
    handleMouseDown: !isInSelectMode ? handleMouseDown : undefined,
    handleClick,
    handleContextMenu: !isInSelectMode && !isLocal ? handleContextMenu : undefined,
    handleDoubleClick: !isInSelectMode ? handleContainerDoubleClick : undefined,
    handleContentDoubleClick: !IS_TOUCH_ENV ? stopPropagation : undefined,
    isSwiped,
  };
}
