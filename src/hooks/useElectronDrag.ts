import type { RefObject } from 'react';
import { useEffect, useRef } from '../lib/teact/teact';

import { IS_ELECTRON, IS_MAC_OS } from '../util/windowEnvironment';

const DRAG_DISTANCE_THRESHOLD = 5;

const useElectronDrag = (ref: RefObject<HTMLDivElement>) => {
  const isDragging = useRef(false);

  const x = useRef(window.screenX);
  const y = useRef(window.screenY);
  const distance = useRef(0);

  useEffect(() => {
    const element: HTMLDivElement | null = ref.current;
    if (!element || !(IS_ELECTRON && IS_MAC_OS)) return undefined;

    const handleClick = (event: MouseEvent) => {
      distance.current = 0;

      if (isDragging.current) {
        event.preventDefault();
        event.stopPropagation();
        isDragging.current = false;
      }
    };

    const handleMousedown = (event: MouseEvent) => {
      if (isDragging.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleDrag = (event: MouseEvent) => {
      if (event.buttons === 1) {
        distance.current += Math.sqrt((x.current - window.screenX) ** 2 + (y.current - window.screenY) ** 2);

        x.current = window.screenX;
        y.current = window.screenY;

        if (!isDragging.current && distance.current > DRAG_DISTANCE_THRESHOLD) {
          isDragging.current = true;
        }
      }
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (event.currentTarget === event.target) {
        window.electron?.handleDoubleClick();
      }
    };

    element.addEventListener('click', handleClick);
    element.addEventListener('mousedown', handleMousedown);
    element.addEventListener('mousemove', handleDrag);
    element.addEventListener('dblclick', handleDoubleClick);

    return () => {
      element.removeEventListener('click', handleClick);
      element.removeEventListener('mouseup', handleMousedown);
      element.removeEventListener('mousemove', handleDrag);
      element.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [ref]);
};

export default useElectronDrag;
