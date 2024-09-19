import type { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';

import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { IS_TOUCH_ENV } from '../util/windowEnvironment';

const DEFAULT_DURATION = 300;

export default function useFocusAfterAnimation(
  ref: RefObject<HTMLInputElement>, animationDuration = DEFAULT_DURATION,
) {
  useEffect(() => {
    if (IS_TOUCH_ENV) {
      return;
    }

    setTimeout(() => {
      requestMeasure(() => {
        ref.current?.focus();
      });
    }, animationDuration);
  }, [ref, animationDuration]);
}
