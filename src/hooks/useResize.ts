import { RefObject } from 'react';
import { useState, useEffect } from '../lib/teact/teact';
import useFlag from './useFlag';

export const useResize = (
  elementRef: RefObject<HTMLElement>,
  onResize: (width: number) => void,
  onReset: NoneToVoidFunction,
  initialWidth?: number,
) => {
  const [isActive, markIsActive, unmarkIsActive] = useFlag();
  const [initialMouseX, setInitialMouseX] = useState<number>();
  const [initialElementWidth, setInitialElementWidth] = useState<number>();

  useEffect(() => {
    if (!elementRef.current || !initialWidth) {
      return;
    }

    elementRef.current.style.width = `${initialWidth}px`;
  }, [elementRef, initialWidth]);

  const handleMouseUp = () => {
    document.body.classList.remove('no-selection', 'cursor-ew-resize');
  };

  const initResize = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    document.body.classList.add('no-selection', 'cursor-ew-resize');

    setInitialMouseX(event.clientX);
    setInitialElementWidth(elementRef.current!.offsetWidth);
    markIsActive();
  };

  const resetResize = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.preventDefault();
    elementRef.current!.style.width = '';
    onReset();
  };

  useEffect(() => {
    if (!isActive) return;

    const handleMouseMove = (event: MouseEvent) => {
      const newWidth = Math.ceil(initialElementWidth + event.clientX - initialMouseX);
      elementRef.current!.style.width = `${newWidth}px`;
    };

    const stopDrag = () => {
      handleMouseUp();
      document.removeEventListener('mousemove', handleMouseMove, false);
      document.removeEventListener('mouseup', stopDrag, false);
      document.removeEventListener('blur', stopDrag, false);
      onResize(elementRef.current!.offsetWidth);
      unmarkIsActive();
    };

    document.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener('mouseup', stopDrag, false);
    document.addEventListener('blur', stopDrag, false);
  }, [initialElementWidth, initialMouseX, elementRef, onResize, isActive, unmarkIsActive]);

  return { initResize, resetResize, handleMouseUp };
};
