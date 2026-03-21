import usePreviousDeprecated from './usePreviousDeprecated';

export default function useCurrentOrPrev<T>(
  current: T, shouldSkipUndefined = false, shouldForceCurrent = false,
): T {
  const prev = usePreviousDeprecated(current, shouldSkipUndefined) as T;

  // eslint-disable-next-line no-null/no-null
  return shouldForceCurrent || (current !== null && current !== undefined) ? current : prev;
}
