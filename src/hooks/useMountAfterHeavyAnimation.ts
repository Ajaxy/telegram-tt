import { getIsHeavyAnimating, useEffect, useSignal } from '../lib/teact/teact';

import useDerivedState from './useDerivedState';

export default function useMountAfterHeavyAnimation(hasIntersected: boolean) {
  const [getNoHeavyAnimation, setNoHeavyAnimation] = useSignal(false);

  const $getIsHeavyAnimating = getIsHeavyAnimating;

  // Animation is usually started right after the mount, so we use effect to check for it on the next frame
  useEffect(() => {
    if (!$getIsHeavyAnimating()) {
      setNoHeavyAnimation(true);
    }
  }, [$getIsHeavyAnimating, setNoHeavyAnimation]);

  return useDerivedState(() => (getNoHeavyAnimation() && hasIntersected), [getNoHeavyAnimation, hasIntersected]);
}
