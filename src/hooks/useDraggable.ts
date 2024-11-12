import type { RefObject } from 'react';
import { useEffect, useSignal, useState } from '../lib/teact/teact';

import buildStyle from '../util/buildStyle';
import { captureEvents } from '../util/captureEvents';
import useFlag from './useFlag';
import useLastCallback from './useLastCallback';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

let resizeTimeout: number | undefined;

export default function useDraggable(
  ref: RefObject<HTMLElement>,
  dragHandleElementRef: RefObject<HTMLElement>,
  isEnabled: boolean = true,
  originalSize: Size,
) {
  const [elementCurrentPosition, setElementCurrentPosition] = useState<Point | undefined>(undefined);
  const [elementCurrentSize, setElementCurrentSize] = useState<Size | undefined>(undefined);

  const [getElementPositionOnStartDrag, setElementPositionOnStartDrag] = useSignal({ x: 0, y: 0 });
  const [getDragStartPoint, setDragStartPoint] = useSignal({ x: 0, y: 0 });

  const elementPositionOnStartDrag = getElementPositionOnStartDrag();
  const dragStartPoint = getDragStartPoint();

  const element = ref.current;
  const dragHandleElement = dragHandleElementRef.current;

  const [isInitiated, setIsInitiated] = useFlag(false);
  const [wasElementShown, setWasElementShown] = useFlag(false);
  const [isDragging, startDragging, stopDragging] = useFlag(false);
  const [isWindowsResizing, startWindowResizing, stopWindowResizing] = useFlag(false);

  function getVisibleArea() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  const getCenteredPosition = useLastCallback(() => {
    if (!elementCurrentSize) return undefined;
    const { width, height } = elementCurrentSize;

    const visibleArea = getVisibleArea();
    const viewportWidth = visibleArea.width;
    const viewportHeight = visibleArea.height;

    const centeredX = (viewportWidth - width) / 2;
    const centeredY = (viewportHeight - height) / 2;

    return { x: centeredX, y: centeredY };
  });

  useEffect(() => {
    if (element) setWasElementShown();
  }, [element]);

  useEffect(() => {
    if (!isInitiated && elementCurrentSize) {
      const centeredPosition = getCenteredPosition();
      if (!centeredPosition) return;

      setElementCurrentPosition({ x: centeredPosition.x, y: centeredPosition.y });
      setIsInitiated();
    }
  }, [elementCurrentSize, isInitiated, element]);

  const handleStartDrag = useLastCallback((event: MouseEvent | TouchEvent) => {
    const targetElement = event.target as HTMLElement;
    if (targetElement.closest('.no-drag') || !element) {
      return;
    }
    const { pageX, pageY } = ('touches' in event) ? event.touches[0] : event;

    const { left, top } = element.getBoundingClientRect();
    setElementPositionOnStartDrag({ x: left, y: top });
    setDragStartPoint({ x: pageX, y: pageY });

    startDragging();
  });

  const handleRelease = useLastCallback(() => {
    stopDragging();
  });

  useEffect(() => {
    if (!isEnabled) {
      stopDragging();
    }
  }, [isEnabled]);

  const ensurePositionInVisibleArea = (x: number, y: number) => {
    const visibleArea = getVisibleArea();

    const visibleAreaWidth = visibleArea.width;
    const visibleAreaHeight = visibleArea.height;

    const componentWidth = elementCurrentSize!.width;
    const componentHeight = elementCurrentSize!.height;

    let newX = x;
    let newY = y;

    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + componentWidth > visibleAreaWidth) newX = visibleAreaWidth - componentWidth;
    if (newY + componentHeight > visibleAreaHeight) newY = visibleAreaHeight - componentHeight;

    return { x: newX, y: newY };
  };

  const adjustPositionWithinBounds = useLastCallback(() => {
    const position = !wasElementShown ? getCenteredPosition() : elementCurrentPosition;
    if (!elementCurrentSize || !position) return;
    const newPosition = ensurePositionInVisibleArea(position.x, position.y);
    setElementCurrentPosition(newPosition);
  });

  const ensureSizeInVisibleArea = useLastCallback((sizeForCheck: Size) => {
    const newSize = sizeForCheck;

    const visibleArea = getVisibleArea();

    newSize.width = Math.min(visibleArea.width, Math.max(originalSize.width, newSize.width));
    newSize.height = Math.min(visibleArea.height, Math.max(originalSize.height, newSize.height));

    return newSize;
  });

  useEffect(() => {
    const newSize = ensureSizeInVisibleArea({ width: originalSize.width, height: originalSize.height });
    if (newSize) setElementCurrentSize(newSize);
  }, [originalSize]);

  const adjustSizeWithinBounds = useLastCallback(() => {
    if (!elementCurrentSize) return;
    const newSize = ensureSizeInVisibleArea(elementCurrentSize);
    if (newSize) setElementCurrentSize(newSize);
  });

  useEffect(() => {
    adjustPositionWithinBounds();
  }, [elementCurrentSize]);

  useEffect(() => {
    const handleResize = () => {
      startWindowResizing();
      adjustSizeWithinBounds();
      adjustPositionWithinBounds();
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = undefined;
      }
      resizeTimeout = window.setTimeout(() => {
        resizeTimeout = undefined;
        stopWindowResizing();
      }, 250);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = undefined;
      window.removeEventListener('resize', handleResize);
    };
  }, [adjustPositionWithinBounds]);

  const handleDrag = useLastCallback((event: MouseEvent | TouchEvent) => {
    if (!isDragging || !element) return;
    const { pageX, pageY } = ('touches' in event) ? event.touches[0] : event;

    const offsetX = pageX - dragStartPoint.x;
    const offsetY = pageY - dragStartPoint.y;

    const newX = elementPositionOnStartDrag.x + offsetX;
    const newY = elementPositionOnStartDrag.y + offsetY;

    if (elementCurrentSize) setElementCurrentPosition(ensurePositionInVisibleArea(newX, newY));
  });

  useEffect(() => {
    let cleanup: NoneToVoidFunction | undefined;
    if (dragHandleElement && isEnabled) {
      cleanup = captureEvents(dragHandleElement, {
        onCapture: handleStartDrag,
        onDrag: handleDrag,
        onRelease: handleRelease,
        onClick: handleRelease,
        onDoubleClick: handleRelease,
      });
    }
    return cleanup;
  }, [handleDrag, handleStartDrag, isEnabled, dragHandleElement]);

  const cursorStyle = isDragging ? 'cursor: grabbing !important; ' : '';

  if (!isInitiated || !elementCurrentSize || !elementCurrentPosition) {
    return {
      isDragging: false,
      style: cursorStyle,
    };
  }

  const style = buildStyle(
    `left: ${elementCurrentPosition.x}px;`,
    `top: ${elementCurrentPosition.y}px;`,
    `width: ${elementCurrentSize.width}px;`,
    `height: ${elementCurrentSize.height}px;`,
    'position: fixed;',
    (isDragging || isWindowsResizing) && 'transition: none !important;',
    cursorStyle,
  );

  return {
    position: elementCurrentPosition,
    size: elementCurrentSize,
    isDragging,
    style,
  };
}
