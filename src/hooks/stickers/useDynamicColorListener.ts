import { useEffect, useLayoutEffect, useState } from '../../lib/teact/teact';

import { getPropertyHexColor } from '../../util/themeStyle';
import useLastCallback from '../useLastCallback';
import useResizeObserver from '../useResizeObserver';

// Transition required to detect `color` property change.
// Duration parameter describes a delay between color change and color state update.
// Small values may cause large amount of re-renders.
const TRANSITION_PROPERTY = 'color';
const TRANSITION_STYLE = `50ms ${TRANSITION_PROPERTY} linear`;

export default function useDynamicColorListener(ref: React.RefObject<HTMLElement>, isDisabled?: boolean) {
  const [hexColor, setHexColor] = useState<string | undefined>();

  const updateColor = useLastCallback(() => {
    if (!ref.current || isDisabled) {
      setHexColor(undefined);
      return;
    }

    const currentHexColor = getPropertyHexColor(getComputedStyle(ref.current), TRANSITION_PROPERTY);
    setHexColor(currentHexColor);
  });

  // Element does not receive `transitionend` event if parent has `display: none`.
  // We will receive `resize` event when parent is shown again.
  useResizeObserver(ref, updateColor, isDisabled);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || isDisabled) {
      return undefined;
    }

    el.style.setProperty('transition', TRANSITION_STYLE, 'important');

    return () => {
      el.style.removeProperty('transition');
    };
  }, [isDisabled, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    updateColor();

    if (isDisabled) {
      return undefined;
    }

    function handleTransitionEnd(e: TransitionEvent) {
      if (e.propertyName !== TRANSITION_PROPERTY) return;
      updateColor();
    }

    el.addEventListener('transitionend', handleTransitionEnd);

    return () => {
      el.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, [isDisabled, ref, updateColor]);

  return hexColor;
}
