import { type RefObject } from 'react';
import { useEffect } from '../../../../lib/teact/teact';

import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { REM } from '../../../common/helpers/mediaDimensions';

import useLastCallback from '../../../../hooks/useLastCallback';

const OFFSET_X = REM;

export default function useOverlayPosition({
  anchorRef,
  overlayRef,
  isMirrored,
  isForMessageEffect,
  isDisabled,
  id,
} : {
  anchorRef: RefObject<HTMLDivElement>;
  overlayRef: RefObject<HTMLDivElement>;
  isMirrored?: boolean;
  isForMessageEffect?: boolean;
  isDisabled?: boolean;
  id?: string;
}) {
  const updatePosition = useLastCallback(() => {
    const element = overlayRef.current;
    const anchor = anchorRef.current;
    if (!element || !anchor) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    requestMutation(() => {
      const anchorCenterY = anchorRect.top + anchorRect.height / 2;
      const anchorBottomY = anchorRect.bottom;
      const y = isForMessageEffect ? anchorBottomY : anchorCenterY;
      element.style.top = `${y - elementRect.height / 2}px`;

      if (isMirrored) {
        element.style.left = `${anchorRect.left - OFFSET_X}px`;
      } else {
        element.style.right = `${windowWidth - anchorRect.right - OFFSET_X}px`;
      }
    });
  });

  useEffect(() => {
    if (isDisabled) return;
    updatePosition();
  }, [isDisabled, id]);

  useEffect(() => {
    if (isDisabled) return undefined;

    const messagesContainer = anchorRef.current!.closest<HTMLDivElement>('.MessageList')!;
    if (!messagesContainer) return undefined;

    messagesContainer.addEventListener('scroll', updatePosition, { passive: true });

    return () => {
      messagesContainer.removeEventListener('scroll', updatePosition);
    };
  }, [isDisabled, anchorRef]);

  return updatePosition;
}
