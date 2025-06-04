import { useMemo, useRef } from '../../lib/teact/teact';

/**
 * Use this hook to bind `<Transition />` animation to changes in the dependency array.
 * Use optional parameter `noAnimation` if you want to prevent the animation even if the dependency array changes.
*/
export function useTransitionActiveKey(deps: unknown[], noAnimation?: boolean): number {
  const activeKey = useRef(0);

  useMemo(() => {
    if (!noAnimation) activeKey.current += 1;
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [...deps, noAnimation]);

  return activeKey.current;
}
