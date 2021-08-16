import { useEffect } from '../lib/teact/teact';
import { IS_IOS } from '../util/environment';

export default function usePreventIosPinchZoom(isDisabled = false) {
  // Disable viewport zooming on iOS Safari
  useEffect(() => {
    if (!IS_IOS || isDisabled) {
      return undefined;
    }

    document.addEventListener('gesturestart', preventEvent);

    return () => {
      document.removeEventListener('gesturestart', preventEvent);
    };
  }, [isDisabled]);
}

function preventEvent(e: Event) {
  e.preventDefault();
}
