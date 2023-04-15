import { useRef } from '../lib/teact/teact';

import type { Signal } from '../util/signals';

import useEffectOnce from './useEffectOnce';

// Allows to use signal value as "silent" dependency in hooks (not causing updates)
export function useSignalRef<T>(getValue: Signal<T>) {
  const ref = useRef<T>(getValue());

  useEffectOnce(() => {
    return getValue.subscribe(() => {
      ref.current = getValue();
    });
  });

  return ref;
}
