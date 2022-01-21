import { useState } from '../lib/teact/teact';

import useDebounce from './useDebounce';
import useOnChange from './useOnChange';
import useHeavyAnimationCheck from './useHeavyAnimationCheck';
import useFlag from './useFlag';

export default function useDebouncedMemo<R extends any, D extends any[]>(
  resolverFn: () => R, ms: number, dependencies: D,
): R | undefined {
  const runDebounced = useDebounce(ms, true);
  const [value, setValue] = useState<R>();
  const [isFrozen, freeze, unfreeze] = useFlag();

  useHeavyAnimationCheck(freeze, unfreeze);

  useOnChange(() => {
    if (isFrozen) {
      return;
    }

    runDebounced(() => {
      setValue(resolverFn());
    });
  }, [...dependencies, isFrozen]);

  return value;
}
