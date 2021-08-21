import { IS_IOS, IS_TOUCH_ENV } from './environment';

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
  ) => boolean | void;
  onSwipe?: (e: Event, direction: SwipeDirection) => boolean | void;
  onClick?: (e: MouseEvent | TouchEvent) => void;
  excludedClosestSelector?: string;
  selectorToPreventScroll?: string;
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

const IOS_SCREEN_EDGE_THRESHOLD = 20;
const MOVED_THRESHOLD = 15;
const SWIPE_THRESHOLD = 50;

export function captureEvents(element: HTMLElement, options: CaptureOptions) {
  let captureEvent: MouseEvent | RealTouchEvent | undefined;
  let hasMoved = false;
  let hasSwiped = false;

  function onCapture(e: MouseEvent | RealTouchEvent) {
    if (options.excludedClosestSelector && (
      (e.target as HTMLElement).matches(options.excludedClosestSelector)
      || (e.target as HTMLElement).closest(options.excludedClosestSelector)
    )) {
      return;
    }

    captureEvent = e;

    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onRelease);
    } else if (e.type === 'touchstart') {
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onRelease);
      document.addEventListener('touchcancel', onRelease);

      if ('touches' in e) {
        if (e.pageX === undefined) {
          e.pageX = e.touches[0].pageX;
        }

        if (e.pageY === undefined) {
          e.pageY = e.touches[0].pageY;
        }
      }
    }

    document.body.classList.add('no-selection');
    if (options.withCursor) {
      document.body.classList.add('cursor-grabbing');
    }

    if (options.onCapture) {
      options.onCapture(e);
    }
  }

  function onRelease(e: MouseEvent | TouchEvent) {
    if (captureEvent) {
      if (options.withCursor) {
        document.body.classList.remove('cursor-grabbing');
      }
      document.body.classList.remove('no-selection');

      document.removeEventListener('mouseup', onRelease);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchcancel', onRelease);
      document.removeEventListener('touchend', onRelease);
      document.removeEventListener('touchmove', onMove);

      captureEvent = undefined;

      if (hasMoved) {
        if (IS_TOUCH_ENV && options.selectorToPreventScroll) {
          Array.from(document.querySelectorAll<HTMLElement>(options.selectorToPreventScroll)).forEach((scrollable) => {
            scrollable.style.overflow = '';
          });
        }

        if (options.onRelease) {
          options.onRelease(e);
        }
      } else if (options.onClick && (!('button' in e) || e.button === 0)) {
        options.onClick(e);
      }
    }

    hasMoved = false;
    hasSwiped = false;
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
      }

      const dragOffsetX = e.pageX! - captureEvent.pageX!;
      const dragOffsetY = e.pageY! - captureEvent.pageY!;

      if (Math.abs(dragOffsetX) >= MOVED_THRESHOLD || Math.abs(dragOffsetY) >= MOVED_THRESHOLD) {
        hasMoved = true;
      }

      let shouldPreventScroll: boolean | void;

      if (options.onDrag) {
        shouldPreventScroll = options.onDrag(e, captureEvent, { dragOffsetX, dragOffsetY });
      }

      if (options.onSwipe && !hasSwiped) {
        hasSwiped = onSwipe(e, dragOffsetX, dragOffsetY);
        shouldPreventScroll = hasSwiped;
      }

      if (IS_TOUCH_ENV && shouldPreventScroll && options.selectorToPreventScroll) {
        if (options.selectorToPreventScroll) {
          Array.from(document.querySelectorAll<HTMLElement>(options.selectorToPreventScroll)).forEach((scrollable) => {
            scrollable.style.overflow = 'hidden';
          });
        }
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

    return processSwipe(e, axis, dragOffsetX, dragOffsetY, options.onSwipe!);
  }

  element.addEventListener('mousedown', onCapture);
  element.addEventListener('touchstart', onCapture, { passive: true });

  return () => {
    element.removeEventListener('mousedown', onCapture);
    element.removeEventListener('touchstart', onCapture);
  };
}

function processSwipe(
  e: Event,
  currentSwipeAxis: TSwipeAxis,
  dragOffsetX: number,
  dragOffsetY: number,
  onSwipe: (e: Event, direction: SwipeDirection) => boolean | void,
) {
  let isSwiped: boolean | void = false;

  if (currentSwipeAxis === 'x') {
    if (dragOffsetX < 0) {
      isSwiped = onSwipe(e, SwipeDirection.Left);
    } else {
      isSwiped = onSwipe(e, SwipeDirection.Right);
    }
  } else if (currentSwipeAxis === 'y') {
    if (dragOffsetY < 0) {
      isSwiped = onSwipe(e, SwipeDirection.Up);
    } else {
      isSwiped = onSwipe(e, SwipeDirection.Down);
    }
  }

  return isSwiped === undefined ? true : isSwiped;
}
