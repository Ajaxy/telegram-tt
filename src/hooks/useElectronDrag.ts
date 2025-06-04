import type { ElementRef } from '../lib/teact/teact';
import { useEffect, useRef } from '../lib/teact/teact';

import { ELECTRON_WINDOW_DRAG_EVENT_END, ELECTRON_WINDOW_DRAG_EVENT_START } from '../config';
import { IS_ELECTRON, IS_MAC_OS } from '../util/browser/windowEnvironment';

const DRAG_DISTANCE_THRESHOLD = 5;

const useElectronDrag = (ref: ElementRef<HTMLDivElement>) => {
  const isDragging = useRef(false);

  const x = useRef(window.screenX);
  const y = useRef(window.screenY);
  const distance = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || !(IS_ELECTRON && IS_MAC_OS)) return undefined;

    const handleClick = (event: MouseEvent) => {
      if (isDragging.current) {
        event.preventDefault();
        event.stopPropagation();
        isDragging.current = false;
        document.body.dispatchEvent(new CustomEvent(ELECTRON_WINDOW_DRAG_EVENT_END));
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      distance.current = 0;
      isDragging.current = false;
      x.current = window.screenX;
      y.current = window.screenY;
    };

    const handleDrag = (event: MouseEvent) => {
      if (event.buttons === 1) {
        const deltaX = x.current - window.screenX;
        const deltaY = y.current - window.screenY;
        const deltaDistance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
        distance.current += deltaDistance;

        x.current = window.screenX;
        y.current = window.screenY;

        if (!isDragging.current && distance.current > DRAG_DISTANCE_THRESHOLD) {
          isDragging.current = true;
          document.body.dispatchEvent(new CustomEvent(ELECTRON_WINDOW_DRAG_EVENT_START));
        }
      }
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (event.currentTarget === event.target) {
        window.electron?.handleDoubleClick();
      }
    };

    element.addEventListener('click', handleClick);
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleDrag);
    element.addEventListener('dblclick', handleDoubleClick);

    return () => {
      element.removeEventListener('click', handleClick);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mousemove', handleDrag);
      element.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [ref]);
};

export default useElectronDrag;
