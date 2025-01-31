import type { RefObject } from 'react';
import {
  useEffect, useSignal, useState,
} from '../lib/teact/teact';

import type { Point, Size } from '../types';

import { RESIZE_HANDLE_SELECTOR } from '../config';
import buildStyle from '../util/buildStyle';
import { captureEvents } from '../util/captureEvents';
import useFlag from './useFlag';
import useLastCallback from './useLastCallback';

export enum ResizeHandleType {
  Top,
  Bottom,
  Left,
  Right,
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight,
}

type ResizeHandleSelectorType = 'top' | 'bottom' | 'left'
| 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const resizeHandleSelectorsMap: Record<ResizeHandleSelectorType, ResizeHandleType> = {
  top: ResizeHandleType.Top,
  bottom: ResizeHandleType.Bottom,
  left: ResizeHandleType.Left,
  right: ResizeHandleType.Right,
  topLeft: ResizeHandleType.TopLeft,
  topRight: ResizeHandleType.TopRight,
  bottomLeft: ResizeHandleType.BottomLeft,
  bottomRight: ResizeHandleType.BottomRight,
};

const resizeHandleSelectors = Object.keys(resizeHandleSelectorsMap) as ResizeHandleSelectorType[];

let resizeTimeout: number | undefined;
const FULLSCREEN_POSITION = { x: 0, y: 0 };

export default function useDraggable(
  ref: RefObject<HTMLElement>,
  dragHandleElementRef: RefObject<HTMLElement>,
  isDragEnabled: boolean = true,
  originalSize: Size,
  isFullscreen: boolean = false,
  minimumSize: Size = { width: 0, height: 0 },
  cachedPosition?: Point,
) {
  const [elementCurrentPosition, setElementCurrentPosition] = useState<Point | undefined>(cachedPosition);
  const [elementCurrentSize, setElementCurrentSize] = useState<Size | undefined>(undefined);

  const [getElementPositionOnStartTransform, setElementPositionOnStartTransform] = useSignal({ x: 0, y: 0 });
  const [getElementSizeOnStartTransform, setElementSizeOnStartTransform] = useSignal({ width: 0, height: 0 });
  const [getTransformStartPoint, setTransformStartPoint] = useSignal({ x: 0, y: 0 });

  const elementPositionOnStartTransform = getElementPositionOnStartTransform();
  const transformStartPoint = getTransformStartPoint();

  const element = ref.current;
  const dragHandleElement = dragHandleElementRef.current;

  const [isInitiated, setIsInitiated] = useFlag(false);
  const [wasElementShown, setWasElementShown] = useFlag(false);
  const [isDragging, startDragging, stopDragging] = useFlag(false);
  const [isResizing, startResizing, stopResizing] = useFlag(false);
  const [isWindowsResizing, startWindowResizing, stopWindowResizing] = useFlag(false);

  const [hitResizeHandle, setHitResizeHandle] = useState<ResizeHandleType | undefined>(undefined);

  function getVisibleArea() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  const updateCurrentPosition = useLastCallback((position: Point) => {
    if (!isFullscreen) setElementCurrentPosition({ x: position.x, y: position.y });
  });

  const getActualPosition = useLastCallback(() => {
    return isFullscreen ? FULLSCREEN_POSITION : elementCurrentPosition;
  });

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

      updateCurrentPosition(centeredPosition);
      setIsInitiated();
    }
  }, [elementCurrentSize, isInitiated, element]);

  const handleStartDrag = useLastCallback((event: MouseEvent | TouchEvent) => {
    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    }

    const targetElement = event.target as HTMLElement;
    if (targetElement.closest('.no-drag') || !element) {
      return;
    }
    const { pageX, pageY } = ('touches' in event) ? event.touches[0] : event;

    const { left, top } = element.getBoundingClientRect();
    setElementPositionOnStartTransform({ x: left, y: top });
    setTransformStartPoint({ x: pageX, y: pageY });

    startDragging();
  });

  function getResizeHandleFromTarget(targetElement: HTMLElement) {
    const closest = (selector: string) => targetElement.closest(selector);

    if (!closest(RESIZE_HANDLE_SELECTOR)) return undefined;
    for (const selector of resizeHandleSelectors) {
      if (closest(`.${selector}`)) { return resizeHandleSelectorsMap[selector]; }
    }
    return undefined;
  }

  const handleStartResize = useLastCallback((event: MouseEvent | TouchEvent) => {
    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    }

    const targetElement = event.target as HTMLElement;
    if (!element || !targetElement) {
      return;
    }
    const resizeHandle = getResizeHandleFromTarget(targetElement);

    if (resizeHandle === undefined) return;
    setHitResizeHandle(resizeHandle);

    const { pageX, pageY } = ('touches' in event) ? event.touches[0] : event;

    const {
      left, right, top, bottom,
    } = element.getBoundingClientRect();
    setElementPositionOnStartTransform({ x: left, y: top });
    setElementSizeOnStartTransform({ width: right - left, height: bottom - top });
    setTransformStartPoint({ x: pageX, y: pageY });

    startResizing();
  });

  const handleDragRelease = useLastCallback(() => {
    stopDragging();
  });

  const handleResizeRelease = useLastCallback(() => {
    stopResizing();
  });

  useEffect(() => {
    if (!isDragEnabled) {
      stopDragging();
    }
  }, [isDragEnabled]);

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
    if (isFullscreen) return;
    const position = !wasElementShown && !cachedPosition ? getCenteredPosition() : elementCurrentPosition;
    if (!elementCurrentSize || !position) return;
    const newPosition = ensurePositionInVisibleArea(position.x, position.y);
    updateCurrentPosition(newPosition);
  });

  const ensureSizeInVisibleArea = useLastCallback((sizeForCheck: Size) => {
    const newSize = sizeForCheck;

    const visibleArea = getVisibleArea();

    const originalWidth = originalSize.width;
    const originalHeight = originalSize.height;
    newSize.width = Math.min(visibleArea.width, Math.max(originalWidth, newSize.width));
    newSize.height = Math.min(visibleArea.height, Math.max(originalHeight, newSize.height));

    return newSize;
  });

  useEffect(() => {
    if (isResizing) return;
    const newSize = ensureSizeInVisibleArea({ width: originalSize.width, height: originalSize.height });
    if (newSize) setElementCurrentSize(newSize);
  }, [originalSize, isResizing]);

  const adjustSizeWithinBounds = useLastCallback(() => {
    if (!elementCurrentSize || isResizing) return;
    const newSize = ensureSizeInVisibleArea(elementCurrentSize);
    if (newSize) setElementCurrentSize(newSize);
  });

  useEffect(() => {
    if (isResizing) return;
    adjustPositionWithinBounds();
  }, [elementCurrentSize, isResizing]);

  useEffect(() => {
    const handleWindowResize = () => {
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

    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = undefined;
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [adjustPositionWithinBounds]);

  const handleDrag = useLastCallback((event: MouseEvent | TouchEvent) => {
    if (!isDragging || !element) return;
    const { pageX, pageY } = ('touches' in event) ? event.touches[0] : event;

    const offsetX = pageX - transformStartPoint.x;
    const offsetY = pageY - transformStartPoint.y;

    const newX = elementPositionOnStartTransform.x + offsetX;
    const newY = elementPositionOnStartTransform.y + offsetY;

    if (elementCurrentSize) setElementCurrentPosition(ensurePositionInVisibleArea(newX, newY));
  });

  const handleResize = useLastCallback((event: MouseEvent | TouchEvent) => {
    if (!isResizing || !element || hitResizeHandle === undefined) return;
    const { pageX, pageY } = ('touches' in event) ? event.touches[0] : event;
    const sizeOnStartTransform = getElementSizeOnStartTransform();

    const pageVisibleX = Math.min(Math.max(0, pageX), getVisibleArea().width);
    const pageVisibleY = Math.min(Math.max(0, pageY), getVisibleArea().height);

    const offsetX = pageVisibleX - transformStartPoint.x;
    const offsetY = pageVisibleY - transformStartPoint.y;

    const maxX = elementPositionOnStartTransform.x + sizeOnStartTransform.width - minimumSize.width;
    const maxY = elementPositionOnStartTransform.y + sizeOnStartTransform.height - minimumSize.height;

    const originalBounds = {
      x: elementPositionOnStartTransform.x,
      y: elementPositionOnStartTransform.y,
      width: sizeOnStartTransform.width,
      height: sizeOnStartTransform.height,
    };

    const newBounds = { ...originalBounds };

    if (hitResizeHandle === ResizeHandleType.Left
    || hitResizeHandle === ResizeHandleType.TopLeft
    || hitResizeHandle === ResizeHandleType.BottomLeft
    ) {
      newBounds.width = Math.max(sizeOnStartTransform.width - offsetX, minimumSize.width);
      newBounds.x = Math.min(newBounds.x + offsetX, maxX);
    }

    if (hitResizeHandle === ResizeHandleType.Right
    || hitResizeHandle === ResizeHandleType.TopRight
    || hitResizeHandle === ResizeHandleType.BottomRight
    ) {
      newBounds.width = Math.max(sizeOnStartTransform.width + offsetX, minimumSize.width);
    }

    if (hitResizeHandle === ResizeHandleType.Top
    || hitResizeHandle === ResizeHandleType.TopLeft
    || hitResizeHandle === ResizeHandleType.TopRight
    ) {
      newBounds.height = Math.max(sizeOnStartTransform.height - offsetY, minimumSize.height);
      newBounds.y = Math.min(newBounds.y + offsetY, maxY);
    }

    if (hitResizeHandle === ResizeHandleType.Bottom
    || hitResizeHandle === ResizeHandleType.BottomLeft
    || hitResizeHandle === ResizeHandleType.BottomRight
    ) {
      newBounds.height = Math.max(sizeOnStartTransform.height + offsetY, minimumSize.height);
    }

    setElementCurrentSize({ width: newBounds.width, height: newBounds.height });
    setElementCurrentPosition({ x: newBounds.x, y: newBounds.y });
  });

  useEffect(() => {
    let cleanup: NoneToVoidFunction | undefined;
    if (dragHandleElement && isDragEnabled) {
      cleanup = captureEvents(dragHandleElement, {
        onCapture: handleStartDrag,
        onDrag: handleDrag,
        onRelease: handleDragRelease,
        onClick: handleDragRelease,
        onDoubleClick: handleDragRelease,
      });
    }
    return cleanup;
  }, [isDragEnabled, dragHandleElement]);

  useEffect(() => {
    const cleanups: NoneToVoidFunction[] = [];
    if (element && isDragEnabled) {
      for (const selector of resizeHandleSelectors) {
        const resizeHandler = element.querySelector(`.resizeHandle.${selector}`) as HTMLElement;

        if (resizeHandler) {
          const cleanup = captureEvents(resizeHandler, {
            onCapture: handleStartResize,
            onDrag: handleResize,
            onRelease: handleResizeRelease,
            onClick: handleResizeRelease,
            onDoubleClick: handleResizeRelease,
          });

          if (cleanup) {
            cleanups.push(cleanup);
          }
        }
      }
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [isDragEnabled, element]);

  const cursorStyle = isDragging ? 'cursor: grabbing !important; ' : '';

  const actualPosition = getActualPosition();

  if (!isInitiated || !elementCurrentSize || !actualPosition) {
    return {
      isDragging: false,
      style: cursorStyle,
    };
  }

  const style = buildStyle(
    `left: ${actualPosition.x}px;`,
    `top: ${actualPosition.y}px;`,
    !isFullscreen && `max-width: ${elementCurrentSize.width}px;`,
    !isFullscreen && `max-height: ${elementCurrentSize.height}px;`,
    'position: fixed;',
    (isDragging || isResizing || isWindowsResizing) && 'transition: none !important;',
    cursorStyle,
  );

  return {
    position: elementCurrentPosition,
    size: elementCurrentSize,
    isDragging,
    isResizing,
    style,
  };
}
