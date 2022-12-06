import { useEffect } from '../lib/teact/teact';
import { throttle } from '../util/schedulers';

const THROTTLE = 300;

export function useResizeObserver(
  ref: React.RefObject<HTMLElement> | undefined,
  onResize: (entry: ResizeObserverEntry) => void,
  withThrottle = false,
) {
  useEffect(() => {
    if (!('ResizeObserver' in window) || !ref?.current) {
      return undefined;
    }

    const callback: ResizeObserverCallback = ([entry]) => {
      // During animation
      if (!(entry.target as HTMLElement).offsetParent) {
        return;
      }

      onResize(entry);
    };
    const observer = new ResizeObserver(withThrottle ? throttle(callback, THROTTLE, false) : callback);

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [onResize, ref, withThrottle]);
}
