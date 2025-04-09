import { useMemo, useRef } from '../../lib/teact/teact';

/**
 * Use this hook to bind `<Transition />` animation to changes in the dependency array.
 * Use optional parameter `noAnimation` if you want to prevent the animation even if the dependency array changes.
*/
export function useTransitionActiveKey(deps: unknown[], noAnimation?: boolean): number {
  const activeKey = useRef(0);
  let didUpdate = false;

  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  useMemo(() => { activeKey.current += 1; didUpdate = true; }, deps);

  if (noAnimation && didUpdate) activeKey.current -= 1;

  return activeKey.current;
}
