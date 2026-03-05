import { useRef, useState } from '@teact';

import type { DrawAction, DrawTool } from '../canvasUtils';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const DEFAULT_BRUSH_SIZE = 5;

interface UseDrawingOptions {
  getCanvasCoordinates: (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => { x: number; y: number };
  canvasToImageCoords: (x: number, y: number) => { x: number; y: number };
  selectedColor: string;
  onActionComplete: (action: DrawAction) => void;
}

export default function useDrawing({
  getCanvasCoordinates,
  canvasToImageCoords,
  selectedColor,
  onActionComplete,
}: UseDrawingOptions) {
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [currentDrawAction, setCurrentDrawAction] = useState<DrawAction | undefined>(undefined);
  const [isDrawing, markDrawing, unmarkDrawing] = useFlag(false);
  const lastCompletedActionRef = useRef<DrawAction | undefined>(undefined);

  const handlePointerMove = useLastCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    // Also check lastCompletedActionRef to prevent moves after completion (stale state race)
    if (!isDrawing || !currentDrawAction || lastCompletedActionRef.current === currentDrawAction) return;

    const canvasCoords = getCanvasCoordinates(e);
    const imageCoords = canvasToImageCoords(canvasCoords.x, canvasCoords.y);
    const isShiftPressed = 'shiftKey' in e ? e.shiftKey : false;

    // When shift is pressed, only keep first and last point (straight line)
    const newPoints = isShiftPressed
      ? [currentDrawAction.points[0], imageCoords]
      : [...currentDrawAction.points, imageCoords];

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

    document.removeEventListener('mousemove', handlePointerMove);
    document.removeEventListener('touchmove', handlePointerMove);
    document.removeEventListener('mouseup', handlePointerUp);
    document.removeEventListener('touchend', handlePointerUp);
  });

  const handlePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    markDrawing();
    const canvasCoords = getCanvasCoordinates(e);
    const imageCoords = canvasToImageCoords(canvasCoords.x, canvasCoords.y);
    const isShiftPressed = 'shiftKey' in e ? e.shiftKey : false;

    setCurrentDrawAction({
      type: 'draw',
      tool: drawTool,
      points: [imageCoords],
      color: selectedColor,
      brushSize,
      isShiftPressed,
    });

    // Attach document listeners to continue drawing even when cursor leaves canvas
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('touchmove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handlePointerUp);
  });

  const resetDrawing = useLastCallback(() => {
    setCurrentDrawAction(undefined);
    unmarkDrawing();
  });

  return {
    drawTool,
    setDrawTool,
    brushSize,
    setBrushSize,
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
