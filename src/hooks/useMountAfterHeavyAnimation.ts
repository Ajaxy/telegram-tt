import { useEffect } from '../lib/teact/teact';

import useFlag from './useFlag';
import { getIsHeavyAnimating } from './useHeavyAnimationCheck';

export default function useMountAfterHeavyAnimation() {
  const [isReadyToMount, markReadyToMount] = useFlag(false);

  const $getIsHeavyAnimating = getIsHeavyAnimating;

  // Animation is often started right after the mount, so we use effect to check for it on the next frame
  useEffect(() => {
    if (!$getIsHeavyAnimating()) {
      markReadyToMount();
    }
  }, [$getIsHeavyAnimating]);

  return isReadyToMount;
}
