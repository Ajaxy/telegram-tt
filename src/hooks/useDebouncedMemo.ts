import {
  getIsHeavyAnimating, useCallback, useRef, useState,
} from '../lib/teact/teact';

import useForceUpdate from './useForceUpdate';
import useHeavyAnimation from './useHeavyAnimation';
import useRunDebounced from './useRunDebounced';
import useSyncEffect from './useSyncEffect';

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
  useHeavyAnimation(noop, handleUnfreeze);

  return {
    isFrozen: getIsHeavyAnimating(),
    updateWhenUnfrozen,
  };
}

function noop() {
}
