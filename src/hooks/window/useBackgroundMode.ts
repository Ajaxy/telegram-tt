import { useEffect } from '@teact';

import { createSignal } from '../../util/signals';
import useLastCallback from '../useLastCallback';

const [getIsInBackgroundLocal, setIsInBackground] = createSignal(!document.hasFocus());
export const getIsInBackground = getIsInBackgroundLocal;

function handleBlur() {
  setIsInBackground(true);
}

function handleFocus() {
  setIsInBackground(false);
}

window.addEventListener('blur', handleBlur);
window.addEventListener('focus', handleFocus);

export default function useBackgroundMode(
  onBlur?: AnyToVoidFunction,
  onFocus?: AnyToVoidFunction,
  isDisabled = false,
) {
  const lastOnBlur = useLastCallback(onBlur);
  const lastOnFocus = useLastCallback(onFocus);

  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (getIsInBackground()) {
      lastOnBlur();
    }

    return getIsInBackground.subscribe(() => {
      if (getIsInBackground()) {
        lastOnBlur();
      } else {
        lastOnFocus();
      }
    });
  }, [isDisabled, lastOnBlur, lastOnFocus]);
}

export function isBackgroundModeActive() {
  return getIsInBackground();
}
