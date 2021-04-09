import usePrevious from './usePrevious';

export default function useCurrentOrPrev<T extends any>(
  current: T, shouldSkipUndefined = false, shouldForceCurrent = false,
): T | undefined {
  const prev = usePrevious(current, shouldSkipUndefined);

  // eslint-disable-next-line no-null/no-null
  return shouldForceCurrent || (current !== null && current !== undefined) ? current : prev;
}
