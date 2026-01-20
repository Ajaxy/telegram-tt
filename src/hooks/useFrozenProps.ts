import { useRef } from '../lib/teact/teact';

export default function useFrozenProps<T extends Record<string, unknown>>(
  props: T,
  shouldFreeze: boolean,
  alwaysFreshKeys?: readonly (keyof T)[],
): T {
  const frozenRef = useRef<T>(props);

  if (!shouldFreeze) {
    frozenRef.current = props;
  } else if (alwaysFreshKeys?.length) {
    const updates: Partial<T> = {};
    for (const key of alwaysFreshKeys) {
      updates[key] = props[key];
    }
    frozenRef.current = {
      ...frozenRef.current,
      ...updates,
    };
  }

  return frozenRef.current;
}
