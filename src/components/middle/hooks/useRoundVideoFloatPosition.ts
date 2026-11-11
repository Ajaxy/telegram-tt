import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef } from '../../../lib/teact/teact';
import { addExtraClass, removeExtraClass, setExtraStyles } from '../../../lib/teact/teact-dom';

import type { MessageList } from '../../../types';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { clamp } from '../../../util/math';
import stopEvent from '../../../util/stopEvent';
import getMiddleColumnVisibleBounds, { isMiddleColumnLayoutTransition } from '../helpers/getMiddleColumnVisibleBounds';

import useLastCallback from '../../../hooks/useLastCallback';
import useThrottledCallback from '../../../hooks/useThrottledCallback';

const FLOAT_MARGIN = 16;
const DRAG_THRESHOLD = 6;
const HALF = 0.5;
const SNAP_DURATION = 250;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  left: number;
  top: number;
  x: number;
  y: number;
  isDragging: boolean;
  hasInterruptedSnap: boolean;
};

export default function useRoundVideoFloatPosition(
  ref: ElementRef<HTMLDivElement>, isFloating: boolean, currentMessageList: MessageList | undefined,
  snappingClassName: string, onClose: NoneToVoidFunction,
) {
  const cornerRef = useRef({ isRight: true, isBottom: false });
  const dragRef = useRef<DragState>();
  const snapTimeoutRef = useRef<number>();

  const updatePosition = useLastCallback(() => {
    if (!isFloating || dragRef.current || !ref.current) return;

    const { offsetWidth: width, offsetHeight: height } = ref.current;
    const area = getAvailableArea(width, height);
    const { isRight, isBottom } = cornerRef.current;
    applyPosition(isRight ? area.right : area.left, isBottom ? area.bottom : area.top);
  });
  const scheduleUpdate = useThrottledCallback(updatePosition, [updatePosition], requestMeasure);
  const handleTransitionEnd = useLastCallback((e: TransitionEvent) => {
    if (isMiddleColumnLayoutTransition(e)) scheduleUpdate();
  });

  function applyPosition(x: number, y: number) {
    requestMutation(() => {
      if (!ref.current) return;
      setExtraStyles(ref.current, { '--round-video-x': `${x}px`, '--round-video-y': `${y}px` });
    });
  }

  function snapToCorner() {
    startSnapping();
    scheduleUpdate();
  }

  function startSnapping() {
    window.clearTimeout(snapTimeoutRef.current);
    requestMutation(() => {
      if (ref.current) addExtraClass(ref.current, snappingClassName);
    });
    snapTimeoutRef.current = window.setTimeout(stopSnapping, SNAP_DURATION);
  }

  function stopSnapping() {
    window.clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = undefined;
    requestMutation(() => {
      if (ref.current) removeExtraClass(ref.current, snappingClassName);
    });
  }

  useEffect(() => {
    if (!isFloating) {
      dragRef.current = undefined;
      return undefined;
    }
    scheduleUpdate();
    const column = document.getElementById('MiddleColumn')!;
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(ref.current!);
    observer.observe(column);
    observer.observe(document.getElementById('RightColumn')!);
    const layoutObserver = new MutationObserver(scheduleUpdate);
    layoutObserver.observe(column.closest('#Main')!, { attributes: true, attributeFilter: ['class'] });
    column.querySelectorAll('.middle-column-footer').forEach((footer) => observer.observe(footer));
    column.addEventListener('transitionend', handleTransitionEnd, true);
    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);

    return () => {
      observer.disconnect();
      layoutObserver.disconnect();
      column.removeEventListener('transitionend', handleTransitionEnd, true);
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    };
  }, [isFloating, currentMessageList, ref, scheduleUpdate]);

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !e.isPrimary || (e.target as HTMLElement).closest('button')) return;
    stopEvent(e);
    const { left, top } = e.currentTarget.getBoundingClientRect();
    const hasInterruptedSnap = snapTimeoutRef.current !== undefined;
    if (hasInterruptedSnap) {
      // Catch the player where the snap has carried it
      stopSnapping();
      applyPosition(left, top);
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      left,
      top,
      x: left,
      y: top,
      isDragging: false,
      hasInterruptedSnap,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  });

  const handlePointerMove = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    if (!drag.isDragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    stopEvent(e);
    drag.isDragging = true;
    drag.x = drag.left + deltaX;
    drag.y = drag.top + deltaY;
    applyPosition(drag.x, drag.y);
    return true;
  });

  const handlePointerUp = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return undefined;
    handlePointerMove(e);
    dragRef.current = undefined;
    if (!drag.isDragging) {
      if (drag.hasInterruptedSnap) snapToCorner();
      return true;
    }

    const { offsetWidth: width, offsetHeight: height } = e.currentTarget;
    const centerX = drag.x + width * HALF;
    const centerY = drag.y + height * HALF;
    if (centerX < 0 || centerX > window.innerWidth || centerY < 0
      || centerY > (window.visualViewport?.height ?? window.innerHeight)) {
      onClose();
    } else {
      const area = getAvailableArea(width, height);
      cornerRef.current = {
        isRight: drag.x > (area.left + area.right) * HALF,
        isBottom: drag.y > (area.top + area.bottom) * HALF,
      };
      snapToCorner();
    }
    return false;
  });

  const handlePointerCancel = useLastCallback(() => {
    const drag = dragRef.current;
    dragRef.current = undefined;
    if (drag?.isDragging || drag?.hasInterruptedSnap) snapToCorner();
  });

  return { handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel };
}

function getAvailableArea(width: number, height: number) {
  const columnElement = document.getElementById('MiddleColumn')!;
  const column = getMiddleColumnVisibleBounds(columnElement);
  // A hidden middle column, such as behind the mobile chat list, leaves the whole screen width
  const canFitColumn = column.right - column.left >= width + FLOAT_MARGIN * 2;
  const maxLeft = Math.max(FLOAT_MARGIN, window.innerWidth - width - FLOAT_MARGIN);
  const left = canFitColumn ? clamp(column.left + FLOAT_MARGIN, FLOAT_MARGIN, maxLeft) : FLOAT_MARGIN;
  const right = canFitColumn ? clamp(column.right - width - FLOAT_MARGIN, left, maxLeft) : maxLeft;
  const bottom = Math.max(FLOAT_MARGIN, column.bottom - height - FLOAT_MARGIN);
  const top = Math.min(column.top + FLOAT_MARGIN, bottom);
  return { left, right, top, bottom };
}
