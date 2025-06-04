import type { ElementRef } from '../lib/teact/teact';
import { useEffect } from '../lib/teact/teact';

import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { IS_TOUCH_ENV } from '../util/browser/windowEnvironment';

const DEFAULT_DURATION = 300;

export default function useFocusAfterAnimation(
  ref: ElementRef<HTMLInputElement>, animationDuration = DEFAULT_DURATION,
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
