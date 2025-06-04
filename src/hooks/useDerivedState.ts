import { useRef } from '../lib/teact/teact';

import type { Signal } from '../util/signals';

import useForceUpdate from './useForceUpdate';
import { useSignalEffect } from './useSignalEffect';
import { useStateRef } from './useStateRef';
import useSyncEffect from './useSyncEffect';

type SyncResolver<T> = () => T;
type AsyncResolver<T> = (setter: (newValue: T) => void) => void;
type Resolver<T> =
  SyncResolver<T>
  | AsyncResolver<T>;

function useDerivedState<T>(resolver: SyncResolver<T>, dependencies: readonly any[]): T;
function useDerivedState<T>(resolver: AsyncResolver<T>, dependencies: readonly any[], isAsync: true): T;
function useDerivedState<T>(signal: Signal<T>): T;

function useDerivedState<T>(resolverOrSignal: Resolver<T> | T, dependencies?: readonly any[], isAsync = false) {
  const resolver = dependencies ? resolverOrSignal as Resolver<T> : () => ((resolverOrSignal as Signal<T>)());
  dependencies ??= [resolverOrSignal];

  const valueRef = useRef<T>();
  const forceUpdate = useForceUpdate();
  const resolverRef = useStateRef(resolver);

  function runCurrentResolver(isSync = false) {
    const currentResolver = resolverRef.current;
    if (isAsync) {
      (currentResolver as AsyncResolver<T>)((newValue) => {
        if (valueRef.current !== newValue) {
          valueRef.current = newValue;
          forceUpdate();
        }
      });
    } else {
      const newValue = (currentResolver as SyncResolver<T>)();
      if (valueRef.current !== newValue) {
        valueRef.current = newValue;

        if (!isSync) {
          forceUpdate();
        }
      }
    }
  }

  useSyncEffect(() => {
    runCurrentResolver(true);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, dependencies);

  useSignalEffect(runCurrentResolver, dependencies);

  return valueRef.current as T;
}

export default useDerivedState;
