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
  onSwipe?: (e: Event, direction: SwipeDirection) => void;
  onClick?: (e: MouseEvent | TouchEvent) => void;
  excludedClosestSelector?: string;
  withCursor?: boolean;
}

// https://stackoverflow.com/questions/11287877/how-can-i-get-e-offsetx-on-mobile-ipad
// Android does not have this value, and iOS has it but as read-only
export interface RealTouchEvent extends TouchEvent {
  pageX?: number;
  pageY?: number;
}

const MOVED_THRESHOLD = 15;
const SWIPE_THRESHOLD = 50;

export function captureEvents(element: HTMLElement, options: CaptureOptions) {
  let captureEvent: MouseEvent | RealTouchEvent | undefined;
  let hasMoved = false;

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
        if (options.onRelease) {
          options.onRelease(e);
        }
      } else if (options.onClick) {
        options.onClick(e);
      }
    }

    hasMoved = false;
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

      if (options.onDrag) {
        e.preventDefault();
        options.onDrag(e, captureEvent, { dragOffsetX, dragOffsetY });
      }

      if (options.onSwipe) {
        processSwipe(e, dragOffsetX, dragOffsetY, options.onSwipe);
      }
    }
  }

  element.addEventListener('mousedown', onCapture);
  element.addEventListener('touchstart', onCapture, { passive: true });

  return () => {
    element.removeEventListener('mousedown', onCapture);
    element.removeEventListener('touchstart', onCapture);
  };
}

function processSwipe(
  e: Event, dragOffsetX: number, dragOffsetY: number, onSwipe: (e: Event, direction: SwipeDirection) => void,
) {
  const xAbs = Math.abs(dragOffsetX);
  const yAbs = Math.abs(dragOffsetY);

  if (dragOffsetX && dragOffsetY) {
    const ratio = Math.max(xAbs, yAbs) / Math.min(xAbs, yAbs);
    // Diagonal swipe
    if (ratio < 2) {
      return;
    }
  }

  if (xAbs >= SWIPE_THRESHOLD) {
    if (dragOffsetX < 0) {
      onSwipe(e, SwipeDirection.Left);
    } else {
      onSwipe(e, SwipeDirection.Right);
    }
  } else if (yAbs >= SWIPE_THRESHOLD) {
    if (dragOffsetY < 0) {
      onSwipe(e, SwipeDirection.Up);
    } else {
      onSwipe(e, SwipeDirection.Down);
    }
  }
}
