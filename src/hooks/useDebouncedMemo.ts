import { useCallback, useRef, useState } from '../lib/teact/teact';

import useRunDebounced from './useRunDebounced';
import useSyncEffect from './useSyncEffect';
import useHeavyAnimationCheck, { isHeavyAnimating } from './useHeavyAnimationCheck';
import useForceUpdate from './useForceUpdate';

export default function useDebouncedMemo<R extends any, D extends any[]>(
  resolverFn: () => R, ms: number, dependencies: D,
): R | undefined {
  const [value, setValue] = useState<R>();
  const { isFrozen, updateWhenUnfrozen } = useHeavyAnimationFreeze();
  const runDebounced = useRunDebounced(ms, true);

  useSyncEffect(() => {
    if (isFrozen) {
      updateWhenUnfrozen();
      return;
    }

    runDebounced(() => {
      setValue(resolverFn());
    });
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [...dependencies, isFrozen]);

  return value;
}

function useHeavyAnimationFreeze() {
  const isPending = useRef(false);

  const updateWhenUnfrozen = useCallback(() => {
    isPending.current = true;
  }, []);

  const forceUpdate = useForceUpdate();
  const handleUnfreeze = useCallback(() => {
    if (!isPending.current) {
      return;
    }

    isPending.current = false;
    forceUpdate();
  }, [forceUpdate]);
  useHeavyAnimationCheck(noop, handleUnfreeze);

  return {
    isFrozen: isHeavyAnimating(),
    updateWhenUnfrozen,
  };
}

function noop() {
}
