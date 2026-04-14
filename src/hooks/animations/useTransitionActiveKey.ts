import { useRef } from '../../lib/teact/teact';

import useSyncEffect from '../useSyncEffect';

/**
 * Use this hook to bind `<Transition />` animation to changes in the dependency array.
 * Use optional parameter `noAnimation` if you want to prevent the animation even if the dependency array changes.
*/
export function useTransitionActiveKey(deps: unknown[], noAnimation?: boolean): number {
  const activeKeyRef = useRef(0);

  useSyncEffect(() => {
    if (!noAnimation) activeKeyRef.current += 1;
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [...deps]);

  return activeKeyRef.current;
}
