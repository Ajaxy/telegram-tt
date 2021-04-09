import { useRef } from '../lib/teact/teact';

import useThrottle from './useThrottle';
import useOnChange from './useOnChange';
import useForceUpdate from './useForceUpdate';

export default <R extends any, D extends any[]>(resolverFn: () => R, ms: number, dependencies: D) => {
  const valueRef = useRef<R>();
  const runThrottled = useThrottle(ms);
  const forceUpdate = useForceUpdate();

  useOnChange(() => {
    let isSync = true;
    runThrottled(() => {
      valueRef.current = resolverFn();

      if (!isSync) {
        forceUpdate();
      }
    });
    isSync = false;
  }, dependencies);

  return valueRef.current;
};
