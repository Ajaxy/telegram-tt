import { IS_IOS } from './environment';

export enum SwipeDirection {
  Up,
  Down,
  Left,
  Right,
}

interface CaptureOptions {
  onCapture?: (e: MouseEvent | TouchEvent) => void;
  onRelease?: (e: MouseEvent | TouchEvent) => void;
  onDrag?: (
    e: MouseEvent | TouchEvent,
    captureEvent: MouseEvent | TouchEvent,
    params: {
      dragOffsetX: number;
      dragOffsetY: number;
    },
  ) => void;
  onSwipe?: (e: Event, direction: SwipeDirection) => boolean;
  onZoom?: (e: TouchEvent, params: {
    // Relative zoom factor
    zoomFactor: number;

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
  onDoubleClick?: (e: MouseEvent | RealTouchEvent, params: { centerX: number; centerY: number }) => void;
  excludedClosestSelector?: string;
  selectorToPreventScroll?: string;
  maxZoom?: number;
  minZoom?: number;
  isNotPassive?: boolean;
  withCursor?: boolean;
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
const MOVED_THRESHOLD = 15;
const SWIPE_THRESHOLD = 50;

function getDistance(a: Touch, b?: Touch) {
  if (!b) return 0;
  return Math.sqrt((b.pageX - a.pageX) ** 2 + (b.pageY - a.pageY) ** 2);
}

function getTouchCenter(a: Touch, b: Touch) {
  return {
    x: (a.pageX + b.pageX) / 2,
    y: (a.pageY + b.pageY) / 2,
  };
}

let lastClickTime = 0;

export function captureEvents(element: HTMLElement, options: CaptureOptions) {
  let captureEvent: MouseEvent | RealTouchEvent | undefined;
  let hasMoved = false;
  let hasSwiped = false;
  let initialDistance = 0;
  let initialTouchCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let initialSwipeAxis: TSwipeAxis | undefined;

  function onCapture(e: MouseEvent | RealTouchEvent) {
    if (options.excludedClosestSelector && (
      (e.target as HTMLElement).matches(options.excludedClosestSelector)
      || (e.target as HTMLElement).closest(options.excludedClosestSelector)
    )) {
      return;
    }

    captureEvent = e;

    if (e.type === 'mousedown') {
      if (options.onDrag) {
        e.preventDefault();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onRelease);
    } else if (e.type === 'touchstart') {
      // We need to always listen on `touchstart` target:
      // https://stackoverflow.com/questions/33298828/touch-move-event-dont-fire-after-touch-start-target-is-removed
      const target = e.target as HTMLElement;
      target.addEventListener('touchmove', onMove, { passive: true });
      target.addEventListener('touchend', onRelease);
      target.addEventListener('touchcancel', onRelease);

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

    if (options.withCursor) {
      document.body.classList.add('cursor-grabbing');
    }

    if (options.onCapture) {
      options.onCapture(e);
    }
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
        Array.from(document.querySelectorAll<HTMLElement>(options.selectorToPreventScroll)).forEach((scrollable) => {
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
    initialDistance = 0;
    initialSwipeAxis = undefined;
    initialTouchCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
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

      if (Math.abs(dragOffsetX) >= MOVED_THRESHOLD || Math.abs(dragOffsetY) >= MOVED_THRESHOLD) {
        hasMoved = true;
      }

      let shouldPreventScroll = false;

      if (options.onDrag) {
        options.onDrag(e, captureEvent, { dragOffsetX, dragOffsetY });
        shouldPreventScroll = true;
      }

      if (options.onSwipe && !hasSwiped) {
        hasSwiped = onSwipe(e, dragOffsetX, dragOffsetY);
        shouldPreventScroll = hasSwiped;
      }

      if (IS_IOS && shouldPreventScroll && options.selectorToPreventScroll) {
        Array.from(document.querySelectorAll<HTMLElement>(options.selectorToPreventScroll)).forEach((scrollable) => {
          scrollable.style.overflow = 'hidden';
        });
      }
    }
  }

  function onSwipe(e: MouseEvent | RealTouchEvent, dragOffsetX: number, dragOffsetY: number) {
    // Avoid conflicts with swipe-to-back gestures
    if (IS_IOS) {
      const x = (e as RealTouchEvent).touches[0].pageX;
      if (x <= IOS_SCREEN_EDGE_THRESHOLD || x >= window.innerWidth - IOS_SCREEN_EDGE_THRESHOLD) {
        return false;
      }
    }

    const xAbs = Math.abs(dragOffsetX);
    const yAbs = Math.abs(dragOffsetY);

    if (dragOffsetX && dragOffsetY) {
      const ratio = Math.max(xAbs, yAbs) / Math.min(xAbs, yAbs);
      // Diagonal swipe
      if (ratio < 2) {
        return false;
      }
    }

    let axis: TSwipeAxis | undefined;
    if (xAbs >= SWIPE_THRESHOLD) {
      axis = 'x';
    } else if (yAbs >= SWIPE_THRESHOLD) {
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

  element.addEventListener('mousedown', onCapture);
  element.addEventListener('touchstart', onCapture, { passive: !options.isNotPassive });

  return () => {
    onRelease();

    element.removeEventListener('touchstart', onCapture);
    element.removeEventListener('mousedown', onCapture);
  };
}

function processSwipe(
  e: Event,
  currentSwipeAxis: TSwipeAxis,
  dragOffsetX: number,
  dragOffsetY: number,
  onSwipe: (e: Event, direction: SwipeDirection) => boolean,
) {
  if (currentSwipeAxis === 'x') {
    if (dragOffsetX < 0) {
      return onSwipe(e, SwipeDirection.Left);
    } else {
      return onSwipe(e, SwipeDirection.Right);
    }
  } else if (currentSwipeAxis === 'y') {
    if (dragOffsetY < 0) {
      return onSwipe(e, SwipeDirection.Up);
    } else {
      return onSwipe(e, SwipeDirection.Down);
    }
  }

  return false;
}
