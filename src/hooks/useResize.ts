import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useState } from '../lib/teact/teact';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import useFlag from './useFlag';
import useLastCallback from './useLastCallback';

export function useResize(
  elementRef: RefObject<HTMLElement>,
  onResize: (width: number) => void,
  onReset: NoneToVoidFunction,
  initialWidth?: number,
  cssPropertyName?: string,
) {
  const [isActive, markIsActive, unmarkIsActive] = useFlag();
  const [initialMouseX, setInitialMouseX] = useState<number>(0);
  const [initialElementWidth, setInitialElementWidth] = useState<number>(0);

  const setElementStyle = useLastCallback((width?: number) => {
    requestMutation(() => {
      if (!elementRef.current) {
        return;
      }

      const widthPx = width ? `${width}px` : '';
      elementRef.current.style.width = widthPx;
      if (cssPropertyName) {
        elementRef.current.style.setProperty(cssPropertyName, widthPx);
      }
    });
  });

  useLayoutEffect(() => {
    if (!elementRef.current || !initialWidth) {
      return;
    }

    setElementStyle(initialWidth);
  }, [cssPropertyName, elementRef, initialWidth, setElementStyle]);

  function handleMouseUp() {
    requestMutation(() => {
      document.body.classList.remove('cursor-ew-resize');
    });
  }

  function initResize(e: React.MouseEvent<HTMLElement, MouseEvent>) {
    e.preventDefault();

    requestMutation(() => {
      document.body.classList.add('cursor-ew-resize');
    });

    setInitialMouseX(e.clientX);
    setInitialElementWidth(elementRef.current!.offsetWidth);
    markIsActive();
  }

  function resetResize(e: React.MouseEvent<HTMLElement, MouseEvent>) {
    e.preventDefault();
    setElementStyle(undefined);
    onReset();
  }

  useEffect(() => {
    if (!isActive) return undefined;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.ceil(initialElementWidth + e.clientX - initialMouseX);
      setElementStyle(newWidth);
    };

    function stopDrag() {
      cleanup();
      onResize(elementRef.current!.offsetWidth);
    }

    function cleanup() {
      handleMouseUp();
      document.removeEventListener('mousemove', handleMouseMove, false);
      document.removeEventListener('mouseup', stopDrag, false);
      document.removeEventListener('blur', stopDrag, false);
      unmarkIsActive();
    }

    document.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener('mouseup', stopDrag, false);
    document.addEventListener('blur', stopDrag, false);

    return cleanup;
  }, [initialElementWidth, initialMouseX, elementRef, onResize, isActive, unmarkIsActive, setElementStyle]);

  return { initResize, resetResize, handleMouseUp };
}
