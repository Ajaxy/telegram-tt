import type { ElementRef } from '../../lib/teact/teact';
import { useMemo } from '../../lib/teact/teact';

import { prepareHexColor } from '../../util/themeStyle';
import useStyleObserver from '../element/useStyleObserver';

const DEBOUNCE = 50; // ms

// Style observer that returns hex color value of the property
export default function useDynamicColorListener(
  ref: ElementRef<HTMLElement>,
  property = 'color',
  isDisabled?: boolean,
) {
  const value = useStyleObserver(ref, property, DEBOUNCE, isDisabled);
  const hexColor = useMemo(() => (value ? prepareHexColor(value) : undefined), [value]);

  return hexColor;
}
