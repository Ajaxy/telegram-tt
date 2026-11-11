import { useRef, useState } from '@teact';

import type { DrawAction, DrawSettings } from '../../../../types/mediaEditor';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import useWindow from '../../../../hooks/useWindow';

export const DEFAULT_BRUSH_SIZE = 5;
const MAX_POINT_SPACING = 12; // px

interface UseDrawingOptions {
  getCanvasCoordinates: (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => { x: number; y: number };
  canvasToImageCoords: (x: number, y: number) => { x: number; y: number };
  settings: DrawSettings;
  displayScale: number;
  onActionComplete: (action: DrawAction) => void;
}

export default function useDrawing({
  getCanvasCoordinates,
  canvasToImageCoords,
  settings,
  displayScale,
  onActionComplete,
}: UseDrawingOptions) {
  const renderingWindow = useWindow();
  const [currentDrawAction, setCurrentDrawAction] = useState<DrawAction | undefined>(undefined);
  const [isDrawing, markDrawing, unmarkDrawing] = useFlag(false);
  const lastCompletedActionRef = useRef<DrawAction | undefined>(undefined);
  const pathSinceLastPointRef = useRef(0);

  const handlePointerMove = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    // Also check lastCompletedActionRef to prevent moves after completion (stale state race)
    if (!isDrawing || !currentDrawAction || lastCompletedActionRef.current === currentDrawAction) return;

    const canvasCoords = getCanvasCoordinates(e);
    const imageCoords = canvasToImageCoords(canvasCoords.x, canvasCoords.y);
    const isShiftPressed = 'shiftKey' in e ? e.shiftKey : false;
    const { points, brushSize } = currentDrawAction;
    const lastPoint = points[points.length - 1];

    const distance = Math.hypot(imageCoords.x - lastPoint.x, imageCoords.y - lastPoint.y) * displayScale;
    pathSinceLastPointRef.current += distance;
    const shouldMoveLastPoint = points.length > 1
      && pathSinceLastPointRef.current < Math.min(brushSize * displayScale, MAX_POINT_SPACING);
    if (!shouldMoveLastPoint) {
      pathSinceLastPointRef.current = 0;
    }

    // When shift is pressed, only keep first and last point (straight line)
    const newPoints = isShiftPressed
      ? [points[0], imageCoords]
      : [...(shouldMoveLastPoint ? points.slice(0, -1) : points), imageCoords];

    setCurrentDrawAction({
      ...currentDrawAction,
      points: newPoints,
      isShiftPressed,
    });
  });

  const handlePointerUp = useLastCallback((e?: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    // Use ref to prevent double completion from mouseup + mouseleave firing together
    if (!isDrawing || !currentDrawAction || lastCompletedActionRef.current === currentDrawAction) return;

    unmarkDrawing();
    const completedAction = {
      ...currentDrawAction,
      completedAt: Date.now(),
    };
    lastCompletedActionRef.current = completedAction;
    setCurrentDrawAction(undefined);
    if (completedAction.points.length > 1) {
      onActionComplete(completedAction);
    }

    const targetDocument = renderingWindow.document;
    targetDocument.removeEventListener('mousemove', handlePointerMove);
    targetDocument.removeEventListener('touchmove', handlePointerMove);
    targetDocument.removeEventListener('mouseup', handlePointerUp);
    targetDocument.removeEventListener('touchend', handlePointerUp);
    targetDocument.removeEventListener('touchcancel', handlePointerUp);
  });

  const handlePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    markDrawing();
    pathSinceLastPointRef.current = 0;
    const canvasCoords = getCanvasCoordinates(e);
    const imageCoords = canvasToImageCoords(canvasCoords.x, canvasCoords.y);
    const isShiftPressed = 'shiftKey' in e ? e.shiftKey : false;

    setCurrentDrawAction({
      type: 'draw',
      tool: settings.tool,
      points: [imageCoords],
      color: settings.color,
      brushSize: settings.size,
      isShiftPressed,
    });

    // Attach document listeners to continue drawing even when cursor leaves canvas
    const targetDocument = renderingWindow.document;
    targetDocument.addEventListener('mousemove', handlePointerMove);
    targetDocument.addEventListener('touchmove', handlePointerMove);
    targetDocument.addEventListener('mouseup', handlePointerUp);
    targetDocument.addEventListener('touchend', handlePointerUp);
    targetDocument.addEventListener('touchcancel', handlePointerUp);
  });

  const resetDrawing = useLastCallback(() => {
    setCurrentDrawAction(undefined);
    unmarkDrawing();
  });

  return {
    currentDrawAction,
    isDrawing,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    resetDrawing,
  };
}

export const MIN_BRUSH_SIZE = 2;
export const MAX_BRUSH_SIZE = 50;
