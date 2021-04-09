import { RefObject } from 'react';

import { IS_TOUCH_ENV } from '../util/environment';
import { fastRaf } from '../util/schedulers';
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
      fastRaf(() => {
        if (ref.current) {
          ref.current.focus();
        }
      });
    }, animationDuration);
  }, [ref, animationDuration]);
}
