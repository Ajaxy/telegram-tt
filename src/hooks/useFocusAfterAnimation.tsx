import type { RefObject } from 'react';
import { requestMutation } from '../lib/fasterdom/fasterdom';

import { IS_TOUCH_ENV } from '../util/windowEnvironment';
import { useEffect } from '../lib/teact/teact';

const DEFAULT_DURATION = 400;

export default function useFocusAfterAnimation(
  ref: RefObject<HTMLInputElement>, animationDuration = DEFAULT_DURATION,
) {
  useEffect(() => {
    if (IS_TOUCH_ENV) {
      return;
    }

    setTimeout(() => {
      requestMutation(() => {
        ref.current?.focus();
      });
    }, animationDuration);
  }, [ref, animationDuration]);
}
