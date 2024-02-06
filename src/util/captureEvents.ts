import { Lethargy } from './lethargy';
import { clamp, round } from './math';
import { debounce } from './schedulers';
import { IS_IOS, IS_WINDOWS } from './windowEnvironment';
import windowSize from './windowSize';

export enum SwipeDirection {
  Up,
  Down,
  Left,
  Right,
}

export interface MoveOffsets {
  dragOffsetX: number;
  dragOffsetY: number;
}

interface CaptureOptions {
  onCapture?: (e: MouseEvent | TouchEvent | WheelEvent) => void;
  onRelease?: (e: MouseEvent | TouchEvent | WheelEvent) => void;
  onDrag?: (
    e: MouseEvent | TouchEvent | WheelEvent,
    captureEvent: MouseEvent | TouchEvent | WheelEvent,
    offsets: MoveOffsets,
    cancelDrag?: (x: boolean, y: boolean) => void,
  ) => void;
  onSwipe?: (e: Event, direction: SwipeDirection, offsets: MoveOffsets) => boolean;
  onZoom?: (e: TouchEvent | WheelEvent, params: {
    // Absolute zoom level
    zoom?: number;
    // Relative zoom factor
    zoomFactor?: number;

    // center coordinate of the initial pinch
    initialCenterX: number;
    initialCenterY: number;

    // offset of the pinch center (current from initial)
    dragOffsetX: number;
    dragOffsetY: number;

    // center coordinate of the current pinch
    currentCenterX: number;
    currentCenterY: number;
  }) => void;
  onClick?: (e: MouseEvent | TouchEvent) => void;
  onDoubleClick?: (e: MouseEvent | RealTouchEvent | WheelEvent, params: { centerX: number; centerY: number }) => void;
  excludedClosestSelector?: string;
  includedClosestSelector?: string;
  selectorToPreventScroll?: string;
  withNativeDrag?: boolean;
  maxZoom?: number;
  minZoom?: number;
  doubleTapZoom?: number;
  initialZoom?: number;
  isNotPassive?: boolean;
  withCursor?: boolean;
  swipeThreshold?: number;
  withWheelDrag?: boolean;
}

// https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
// Android does not have this value, and iOS has it but as read-only
export interface RealTouchEvent extends TouchEvent {
  pageX?: number;
  pageY?: number;
}

type TSwipeAxis =
  'x'
  | 'y'
  | undefined;

export const IOS_SCREEN_EDGE_THRESHOLD = 20;
export const SWIPE_DIRECTION_THRESHOLD = 10;
export const SWIPE_DIRECTION_TOLERANCE = 1.5;

const MOVE_THRESHOLD = 15;
const SWIPE_THRESHOLD_DEFAULT = 20;
const RELEASE_WHEEL_ZOOM_DELAY = 150;
const RELEASE_WHEEL_DRAG_DELAY = 150;

function getDistance(a: Touch, b?: Touch) {
  if (!b) return 0;
  return Math.hypot((b.pageX - a.pageX), (b.pageY - a.pageY));
}

function getTouchCenter(a: Touch, b: Touch) {
  return {
    x: (a.pageX + b.pageX) / 2,
    y: (a.pageY + b.pageY) / 2,
  };
}

let lastClickTime = 0;
const lethargy = new Lethargy({
  stability: 5,
  sensitivity: 25,
  tolerance: IS_WINDOWS ? 1 : 0.6, // Windows `scrollDelta` does not die down to 0
  delay: 150,
});

export function captureEvents(element: HTMLElement, options: CaptureOptions) {
  let captureEvent: MouseEvent | RealTouchEvent | WheelEvent | undefined;
  let hasMoved = false;
  let hasSwiped = false;
  let isZooming = false;
  let initialDistance = 0;
  let wheelZoom = options.initialZoom ?? 1;
  let initialDragOffset = {
    x: 0,
    y: 0,
  };
  let isDragCanceled = {
    x: false,
    y: false,
  };
  const currentWindowSize = windowSize.get();
  let initialTouchCenter = {
    x: currentWindowSize.width / 2,
    y: currentWindowSize.height / 2,
  };
  let initialSwipeAxis: TSwipeAxis | undefined;
  const minZoom = options.minZoom ?? 1;
  const maxZoom = options.maxZoom ?? 4;

  function onCapture(e: MouseEvent | RealTouchEvent) {
    const target = e.target as HTMLElement;
    const {
      excludedClosestSelector,
      includedClosestSelector,
      withNativeDrag,
      withCursor,
      onDrag,
    } = options;

    if (element !== target && !element.contains(target)) {
      return;
    }

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    if (
      (excludedClosestSelector && (target.matches(excludedClosestSelector) || target.closest(excludedClosestSelector)))
      || (
        includedClosestSelector && !(target.matches(includedClosestSelector) || target.closest(includedClosestSelector))
      )
    ) {
      return;
    }

    captureEvent = e;

    if (e.type === 'mousedown') {
      if (!withNativeDrag && onDrag) {
        e.preventDefault();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onRelease);
    } else if (e.type === 'touchstart') {
      // We need to always listen on `touchstart` target:
      // https://stackoverflow.com/questions/33298828/touch-move-event-dont-fire-after-touch-start-target-is-removed
      target.addEventListener('touchmove', onMove, { passive: true });
      target.addEventListener('touchend', onRelease, { passive: true });
      target.addEventListener('touchcancel', onRelease, { passive: true });

      if ('touches' in e) {
        if (e.pageX === undefined) {
          e.pageX = e.touches[0].pageX;
        }

        if (e.pageY === undefined) {
          e.pageY = e.touches[0].pageY;
        }

        if (e.touches.length === 2) {
          initialDistance = getDistance(e.touches[0], e.touches[1]);
          initialTouchCenter = getTouchCenter(e.touches[0], e.touches[1]);
        }
      }
    }

    if (withCursor) {
      document.body.classList.add('cursor-grabbing');
    }

    options.onCapture?.(e);
  }

  function onRelease(e?: MouseEvent | TouchEvent) {
    if (captureEvent) {
      if (options.withCursor) {
        document.body.classList.remove('cursor-grabbing');
      }

      document.removeEventListener('mouseup', onRelease);
      document.removeEventListener('mousemove', onMove);
      (captureEvent.target as HTMLElement).removeEventListener('touchcancel', onRelease);
      (captureEvent.target as HTMLElement).removeEventListener('touchend', onRelease);
      (captureEvent.target as HTMLElement).removeEventListener('touchmove', onMove);

      if (IS_IOS && options.selectorToPreventScroll) {
        Array.from(document.querySelectorAll<HTMLElement>(options.selectorToPreventScroll))
          .forEach((scrollable) => {
            scrollable.style.overflow = '';
          });
      }

      if (e) {
        if (hasMoved) {
          if (options.onRelease) {
            options.onRelease(e);
          }
        } else if (e.type === 'mouseup') {
          if (options.onDoubleClick && Date.now() - lastClickTime < 300) {
            options.onDoubleClick(e, {
              centerX: captureEvent!.pageX!,
              centerY: captureEvent!.pageY!,
            });
          } else if (options.onClick && (!('button' in e) || e.button === 0)) {
            options.onClick(e);
          }
          lastClickTime = Date.now();
        }
      }
    }

    hasMoved = false;
    hasSwiped = false;
    isZooming = false;
    initialDistance = 0;
    wheelZoom = clamp(wheelZoom, minZoom, maxZoom);
    initialSwipeAxis = undefined;
    initialDragOffset = {
      x: 0,
      y: 0,
    };
    isDragCanceled = {
      x: false,
      y: false,
    };
    const newWindowSize = windowSize.get();
    initialTouchCenter = {
      x: newWindowSize.width / 2,
      y: newWindowSize.height / 2,
    };
    captureEvent = undefined;
  }

  function onMove(e: MouseEvent | RealTouchEvent) {
    if (captureEvent) {
      if (e.type === 'touchmove' && ('touches' in e)) {
        if (e.pageX === undefined) {
          e.pageX = e.touches[0].pageX;
        }

        if (e.pageY === undefined) {
          e.pageY = e.touches[0].pageY;
        }

        if (options.onZoom && initialDistance > 0 && e.touches.length === 2) {
          const endDistance = getDistance(e.touches[0], e.touches[1]);
          const touchCenter = getTouchCenter(e.touches[0], e.touches[1]);
          const dragOffsetX = touchCenter.x - initialTouchCenter.x;
          const dragOffsetY = touchCenter.y - initialTouchCenter.y;
          const zoomFactor = endDistance / initialDistance;
          options.onZoom(e, {
            zoomFactor,
            initialCenterX: initialTouchCenter.x,
            initialCenterY: initialTouchCenter.y,
            dragOffsetX,
            dragOffsetY,
            currentCenterX: touchCenter.x,
            currentCenterY: touchCenter.y,
          });
          if (zoomFactor !== 1) hasMoved = true;
        }
      }

      const dragOffsetX = e.pageX! - captureEvent.pageX!;
      const dragOffsetY = e.pageY! - captureEvent.pageY!;

      if (Math.abs(dragOffsetX) >= MOVE_THRESHOLD || Math.abs(dragOffsetY) >= MOVE_THRESHOLD) {
        hasMoved = true;
      }

      let shouldPreventScroll = false;

      if (options.onDrag) {
        options.onDrag(e, captureEvent, {
          dragOffsetX,
          dragOffsetY,
        });
        shouldPreventScroll = true;
      }

      if (options.onSwipe && !hasSwiped) {
        hasSwiped = onSwipe(e, dragOffsetX, dragOffsetY);
        shouldPreventScroll = hasSwiped;
      }

      if (IS_IOS && shouldPreventScroll && options.selectorToPreventScroll) {
        Array.from(document.querySelectorAll<HTMLElement>(options.selectorToPreventScroll))
          .forEach((scrollable) => {
            scrollable.style.overflow = 'hidden';
          });
      }
    }
  }

  function onSwipe(e: MouseEvent | RealTouchEvent, dragOffsetX: number, dragOffsetY: number) {
    // Avoid conflicts with swipe-to-back gestures
    if (IS_IOS) {
      const x = (e as RealTouchEvent).touches[0].pageX;
      if (x <= IOS_SCREEN_EDGE_THRESHOLD || x >= windowSize.get().width - IOS_SCREEN_EDGE_THRESHOLD) {
        return false;
      }
    }

    const xAbs = Math.abs(dragOffsetX);
    const yAbs = Math.abs(dragOffsetY);
    const threshold = options.swipeThreshold ?? SWIPE_THRESHOLD_DEFAULT;

    let axis: TSwipeAxis | undefined;
    if (xAbs > yAbs && xAbs >= threshold) {
      axis = 'x';
    } else if (yAbs > xAbs && yAbs >= threshold) {
      axis = 'y';
    }

    if (!axis) {
      return false;
    }

    if (!initialSwipeAxis) {
      initialSwipeAxis = axis;
    } else if (initialSwipeAxis !== axis) {
      // Prevent horizontal swipe after vertical to prioritize scroll
      return false;
    }

    return processSwipe(e, axis, dragOffsetX, dragOffsetY, options.onSwipe!);
  }

  const releaseWheelDrag = debounce(onRelease, RELEASE_WHEEL_DRAG_DELAY, false);
  const releaseWheelZoom = debounce(onRelease, RELEASE_WHEEL_ZOOM_DELAY, false);

  function onWheelCapture(e: WheelEvent) {
    if (hasMoved) return;
    onCapture(e);
    hasMoved = true;
    initialTouchCenter = { x: e.x, y: e.y };
  }

  function onWheelZoom(e: WheelEvent) {
    if (!options.onZoom) return;
    onWheelCapture(e);
    const dragOffsetX = e.x - initialTouchCenter.x;
    const dragOffsetY = e.y - initialTouchCenter.y;
    const delta = clamp(e.deltaY, -25, 25);
    wheelZoom -= delta * 0.01;
    wheelZoom = clamp(wheelZoom, minZoom * 0.5, maxZoom * 3);
    isZooming = true;
    options.onZoom(e, {
      zoom: round(wheelZoom, 2),
      initialCenterX: initialTouchCenter.x,
      initialCenterY: initialTouchCenter.y,
      dragOffsetX,
      dragOffsetY,
      currentCenterX: e.x,
      currentCenterY: e.y,
    });
    releaseWheelZoom(e);
  }

  function onWheelDrag(e: WheelEvent) {
    if (!options.onDrag) return;
    onWheelCapture(e);
    // Ignore wheel inertia if drag is canceled in this direction
    if (!isDragCanceled.x || Math.sign(initialDragOffset.x) === Math.sign(e.deltaX)) {
      initialDragOffset.x -= e.deltaX;
    }
    if (!isDragCanceled.y || Math.sign(initialDragOffset.y) === Math.sign(e.deltaY)) {
      initialDragOffset.y -= e.deltaY;
    }
    const { x, y } = initialDragOffset;
    options.onDrag(e, captureEvent!, {
      dragOffsetX: x,
      dragOffsetY: y,
    }, (dx, dy) => {
      isDragCanceled = { x: dx, y: dy };
    });
    releaseWheelDrag(e);
  }

  function onWheel(e: WheelEvent) {
    if (!options.onZoom && !options.onDrag) return;
    if (options.excludedClosestSelector && (
      (e.target as HTMLElement).matches(options.excludedClosestSelector)
      || (e.target as HTMLElement).closest(options.excludedClosestSelector)
    )) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const { doubleTapZoom = 3 } = options;
    if (options.onDoubleClick && Object.is(e.deltaX, -0) && Object.is(e.deltaY, -0) && e.ctrlKey) {
      onWheelCapture(e);
      wheelZoom = wheelZoom > 1 ? 1 : doubleTapZoom;
      options.onDoubleClick(e, { centerX: e.pageX, centerY: e.pageY });
      hasMoved = false;
      return;
    }
    const metaKeyPressed = e.metaKey || e.ctrlKey || e.shiftKey;
    if (metaKeyPressed) {
      onWheelZoom(e);
    }
    if (!metaKeyPressed && !isZooming) {
      // Check if this event produced by user scroll and not by inertia
      const isUserEvent = lethargy.check(e);
      if (wheelZoom !== 1 || isUserEvent) {
        onWheelDrag(e);
      }
    }
  }

  if (options.withWheelDrag) {
    element.addEventListener('wheel', onWheel);
  }

  element.addEventListener('mousedown', onCapture);
  document.body.addEventListener('touchstart', onCapture, { passive: !options.isNotPassive });

  return () => {
    onRelease();
    document.body.removeEventListener('touchstart', onCapture);
    element.removeEventListener('mousedown', onCapture);
    element.removeEventListener('wheel', onWheel);
  };
}

function processSwipe(
  e: Event,
  currentSwipeAxis: TSwipeAxis,
  dragOffsetX: number,
  dragOffsetY: number,
  onSwipe: (e: Event, direction: SwipeDirection, offsets: MoveOffsets) => boolean,
) {
  const offsets = { dragOffsetX, dragOffsetY };

  if (currentSwipeAxis === 'x') {
    if (dragOffsetX < 0) {
      return onSwipe(e, SwipeDirection.Left, offsets);
    } else {
      return onSwipe(e, SwipeDirection.Right, offsets);
    }
  } else if (currentSwipeAxis === 'y') {
    if (dragOffsetY < 0) {
      return onSwipe(e, SwipeDirection.Up, offsets);
    } else {
      return onSwipe(e, SwipeDirection.Down, offsets);
    }
  }

  return false;
}
