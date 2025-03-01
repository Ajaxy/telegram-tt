import { useEffect, useLayoutEffect, useState } from '../../lib/teact/teact';

import useLastCallback from '../useLastCallback';
import useResizeObserver from '../useResizeObserver';

const UPDATE_DEBOUNCE = 50; // ms

/**
 * @param property animateable property
 */
export default function useStyleObserver(
  ref: React.RefObject<HTMLElement>,
  property: string,
  debounce = UPDATE_DEBOUNCE,
  isDisabled?: boolean,
) {
  const [value, setValue] = useState<string | undefined>();

  const updateValue = useLastCallback(() => {
    if (!ref.current || isDisabled) {
      setValue(undefined);
      return;
    }

    const computedValue = getComputedStyle(ref.current).getPropertyValue(property).trim();
    setValue(computedValue);
  });

  // Element does not receive `transitionend` event if parent has `display: none`.
  // We will receive `resize` event when parent is shown again.
  useResizeObserver(ref, updateValue, isDisabled);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || isDisabled) {
      return undefined;
    }

    el.style.setProperty('transition', `${debounce}ms ${property} linear`, 'important');

    return () => {
      el.style.removeProperty('transition');
    };
  }, [debounce, isDisabled, property, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    updateValue();

    if (isDisabled) {
      return undefined;
    }

    function handleTransitionEnd(e: TransitionEvent) {
      if (e.propertyName !== property) return;
      updateValue();
    }

    el.addEventListener('transitionend', handleTransitionEnd);

    return () => {
      el.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, [isDisabled, property, ref, updateValue]);

  return value;
}
