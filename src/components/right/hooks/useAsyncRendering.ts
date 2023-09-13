import { useEffect, useRef } from '../../../lib/teact/teact';

import useForceUpdate from '../../../hooks/useForceUpdate';
import useSyncEffect from '../../../hooks/useSyncEffect';

export default function useAsyncRendering<T extends any[]>(dependencies: T, delay?: number) {
  const isDisabled = delay === undefined;
  const shouldRenderRef = useRef(isDisabled);
  const timeoutRef = useRef<number>();
  const forceUpdate = useForceUpdate();

  useSyncEffect(() => {
    if (isDisabled) {
      return;
    }

    shouldRenderRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, dependencies);

  useEffect(() => {
    if (isDisabled || shouldRenderRef.current) {
      return;
    }

    const exec = () => {
      shouldRenderRef.current = true;
      forceUpdate();
    };

    if (delay! > 0) {
      timeoutRef.current = window.setTimeout(exec, delay);
    } else {
      exec();
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, dependencies);

  return shouldRenderRef.current;
}
